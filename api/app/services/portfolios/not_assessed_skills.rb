# frozen_string_literal: true

module Portfolios
  # Lists the configured skills that ended up with no score, and says why.
  #
  # Why this exists:
  # once the generator stopped inventing an L1 for skills the interview never
  # covered, those skills simply vanished from the assessor's portfolio screen.
  # The data became correct and the screen became misleading in a new way — an
  # assessor could not tell the difference between "this role needs 5 skills and
  # the candidate was weak on none of them" and "3 of the 5 were never asked about".
  #
  # Being explicit about the gap is the point of the fix, not a side effect of it.
  #
  # Plain Ruby, duck-typed on skill_id / skill_label / state, so it unit tests
  # without a database.
  class NotAssessedSkills
    NOT_DISCUSSED_STATE = 'not_yet'

    # reason:
    #   :not_discussed — the interview never got to this skill (coverage not_yet,
    #                    or no coverage row at all)
    #   :no_rating     — it was discussed, but the model returned nothing usable
    #                    for it, so there is evidence but no defensible level
    Entry = Struct.new(:skill_id, :skill_label, :expected_level, :coverage_state, :reason,
                       keyword_init: true)

    def self.call(assessment_skills:, portfolio_skills:, coverage_maps:)
      new(assessment_skills: assessment_skills,
          portfolio_skills:  portfolio_skills,
          coverage_maps:     coverage_maps).call
    end

    def initialize(assessment_skills:, portfolio_skills:, coverage_maps:)
      @assessment_skills = Array(assessment_skills)
      @scored_keys       = Array(portfolio_skills).flat_map { |skill| keys_for(skill) }.uniq
      @coverage          = CoverageLookup.new(coverage_maps)
      @coverage_maps     = Array(coverage_maps)
    end

    def call
      @assessment_skills.reject { |skill| scored?(skill) }.map { |skill| entry_for(skill) }
    end

    private

    def scored?(skill)
      keys_for(skill).any? { |key| @scored_keys.include?(key) }
    end

    # A skill is matched by id when the model gave one, and by normalised label
    # otherwise — the same two-step match the rest of the pipeline uses.
    def keys_for(skill)
      keys = []
      id = skill.skill_id.to_s.strip
      keys << "id:#{id}" unless id.empty?
      keys << "label:#{normalize(skill.skill_label)}"
      keys
    end

    def entry_for(skill)
      state = @coverage.state_for(skill_id: skill.skill_id, skill_label: skill.skill_label)
      discussed = @coverage.discussed?(skill_id: skill.skill_id, skill_label: skill.skill_label)

      Entry.new(
        skill_id:       skill.skill_id,
        skill_label:    skill.skill_label,
        expected_level: skill.respond_to?(:expected_level) ? skill.expected_level : nil,
        coverage_state: state || NOT_DISCUSSED_STATE,
        reason:         discussed ? :no_rating : :not_discussed
      )
    end

    def normalize(label)
      label.to_s.downcase.strip.gsub(/\s+/, ' ')
    end
  end
end
