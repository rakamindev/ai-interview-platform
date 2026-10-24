# frozen_string_literal: true

require 'digest'

module FitGap
  # A fingerprint of every field that can affect comparison or narrative output.
  # No raw candidate content is stored in the digest column.
  class SourceDigest
    # Changing evidence rules must stale reports produced by the prior policy.
    POLICY_VERSION = 'substantive-distinct-turns-v2'

    def self.call(portfolio:, vacancy:)
      skills = portfolio.portfolio_skills.includes(:assessor_override).order(:id).map do |skill|
        [skill.id, skill.skill_id, skill.skill_label, skill.ai_level, skill.ai_confidence,
         skill.evidence, skill.competency_summary,
         skill.assessor_override&.override_level, skill.assessor_override&.assessor_notes]
      end
      requirements = vacancy.vacancy_skills.order(:id).map do |skill|
        [skill.id, skill.skill_id, skill.skill_label, skill.expected_level]
      end
      coverage = portfolio.session.coverage_maps.order(:id).map do |map|
        [map.skill_id, map.skill_label, map.state, map.probe_count]
      end
      transcript = portfolio.session.transcript_turns.where(speaker: 'candidate').order(:turn_number).pluck(:text)

      Digest::SHA256.hexdigest(JSON.generate([
        POLICY_VERSION, skills, requirements, coverage, transcript,
        vacancy.role_title, vacancy.culture_dimensions, vacancy.competency_expectations
      ]))
    end
  end
end
