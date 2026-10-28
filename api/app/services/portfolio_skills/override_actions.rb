# frozen_string_literal: true

module PortfolioSkills
  # Assessor decisions on one portfolio skill. Every change writes the current
  # override and an AssessorOverrideEvent in the same transaction.
  class OverrideActions
    # Raised with the HTTP status the controller should answer with.
    class Error < StandardError
      attr_reader :status, :code

      def initialize(message, status: :unprocessable_entity, code: nil)
        @status = status
        @code   = code
        super(message)
      end
    end

    def initialize(skill, actor_id:)
      @skill    = skill
      @actor_id = actor_id
    end

    # Sets or changes the assessor level. Returns [override, created].
    def set(level:, notes:, lock_version: nil)
      level = parse_level(level)
      notes = required_notes(notes)
      override = @skill.assessor_override
      from = override&.override_level || @skill.ai_level
      raise Error, "No change: the skill is already at L#{level}" if level == from

      created = override.nil?
      AssessorOverride.transaction do
        override ||= @skill.build_assessor_override(ai_level: @skill.ai_level)
        override.lock_version = lock_version.to_i if !created && lock_version.present?
        override.update!(override_level: level, assessor_notes: notes, ai_level: @skill.ai_level,
                         overridden_by: @actor_id, overridden_at: Time.current)
        record('set', from: from, to: level, notes: notes)
      end
      [override, created]
    rescue ActiveRecord::StaleObjectError
      raise Error.new('This rating was changed by someone else. Reload and try again.', status: :conflict)
    end

    # Removes the override; the skill falls back to its AI rating (or not assessed).
    def revert(notes:)
      override = @skill.assessor_override
      raise Error.new('This skill has no assessor override', status: :not_found) unless override

      notes = required_notes(notes)
      AssessorOverride.transaction do
        record('revert', from: override.override_level, to: @skill.ai_level, notes: notes)
        override.destroy!
      end
    end

    # Records that the assessor agrees with the AI rating, without changing it.
    def confirm(notes: nil)
      raise Error, 'Only an assessed AI rating can be confirmed' unless @skill.assessed?
      raise Error, 'This skill already has an assessor override' if @skill.assessor_override

      notes = notes.to_s.strip.presence
      # Confirming thin evidence moves the skill into the fit totals, so the
      # assessor must record why (same rule as an override).
      if @skill.ai_confidence == 'low' && notes.nil?
        raise Error.new('A note is required to confirm a low-confidence rating', code: 'note_required')
      end

      validate_length(notes)
      record('confirm', from: @skill.ai_level, to: @skill.ai_level, notes: notes)
    end

    private

    def record(action, from:, to:, notes:)
      @skill.override_events.create!(action: action, from_level: from, to_level: to,
                                     ai_level_at_time: @skill.ai_level, notes: notes, actor_id: @actor_id)
    end

    def parse_level(raw)
      level = raw.is_a?(String) && raw.strip.match?(/\A[1-5]\z/) ? raw.to_i : raw
      raise Error, 'Level must be a whole number from 1 to 5' unless level.is_a?(Integer) && level.between?(1, 5)

      level
    end

    def required_notes(raw)
      notes = raw.to_s.strip
      raise Error, 'A note explaining the decision is required' if notes.empty?

      validate_length(notes)
      notes
    end

    def validate_length(notes)
      return if notes.nil? || notes.length <= AssessorOverrideEvent::MAX_NOTES

      raise Error, "Notes must be at most #{AssessorOverrideEvent::MAX_NOTES} characters"
    end
  end
end
