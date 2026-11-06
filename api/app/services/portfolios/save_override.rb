# frozen_string_literal: true

module Portfolios
  # Saves an assessor's override. An override's identity is (portfolio, skill_key): one human decision
  # per skill, however many AI generations come and go.
  #
  # Runs under the same portfolio row lock as generation publication, so the two cannot interleave.
  # If the assessor was looking at a skill row that has just been replaced by a newer generation, the
  # decision is applied to the current row with the same skill_key, never to a stale copy (which
  # would otherwise create a second, competing override).
  class SaveOverride
    Result = Struct.new(:override, :created, keyword_init: true)

    def initialize(portfolio_skill:, override_level:, assessor_notes:, user_id:)
      @portfolio_skill = portfolio_skill
      @override_level  = override_level
      @assessor_notes  = assessor_notes
      @user_id         = user_id
    end

    def call
      portfolio = @portfolio_skill.portfolio
      Portfolio.transaction do
        portfolio.lock!
        portfolio.reload
        source   = @portfolio_skill.reload          # the skill row on the screen the assessor submitted from
        current  = current_skill_for(portfolio, source)
        target   = current || source                # where the decision is applied
        existing = override_for(portfolio, target)

        attributes = {
          portfolio_skill_id:    target.id,
          override_level:        @override_level,
          assessor_notes:        @assessor_notes,
          overridden_by:         @user_id,
          overridden_at:         Time.current,
          # What the assessor actually saw when deciding: the AI level and report of the submitted screen,
          # not of the row we redirect to. Otherwise a save from an old tab would be recorded as if the
          # assessor had reviewed a newer AI rating they never saw.
          ai_level:                 source.ai_level,
          last_decided_on_generation_id: source.generation_id
        }.merge(review_state(portfolio, source, current))

        if existing
          existing.update!(attributes) # first_made_on_generation_id is deliberately left as it was
          Result.new(override: existing, created: false)
        else
          created = AssessorOverride.create!(attributes.merge(first_made_on_generation_id: source.generation_id))
          Result.new(override: created, created: true)
        end
      end
    end

    private

    # The current generation's row for the same skill, if the submitted row is from an older generation.
    def current_skill_for(portfolio, source)
      return nil if portfolio.current_generation_id.nil? || source.generation_id == portfolio.current_generation_id

      portfolio.portfolio_skills.find_by(skill_key: source.skill_key)
    end

    # Cleared only when the decision was made against the current report's own AI rating.
    def review_state(portfolio, source, current)
      if source.generation_id == portfolio.current_generation_id || portfolio.current_generation_id.nil?
        { needs_review: false, review_reason: nil }
      elsif current.nil?
        { needs_review: true, review_reason: 'skill_missing_in_current' }
      elsif current.ai_level != source.ai_level
        { needs_review: true, review_reason: 'ai_level_changed' }
      else
        { needs_review: false, review_reason: nil }
      end
    end

    # The decision to update for this skill: the one already on the target row if any (so the unique
    # index on portfolio_skill_id is respected), otherwise the newest one for the same skill_key.
    def override_for(portfolio, target)
      AssessorOverride.find_by(portfolio_skill_id: target.id) ||
        AssessorOverride.joins(:portfolio_skill)
                        .where(portfolio_skills: { portfolio_id: portfolio.id, skill_key: target.skill_key })
                        .order(overridden_at: :desc, id: :desc).first
    end
  end
end
