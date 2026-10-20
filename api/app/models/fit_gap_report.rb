# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  def discovered_skills
    portfolio.portfolio_skills.where(is_discovered: true).map do |skill|
      override = skill.assessor_override
      {
        skill_id:           skill.skill_id,
        skill_label:        skill.skill_label,
        candidate_level:    override ? override.override_level : skill.ai_level,
        confidence:         skill.ai_confidence,
        competency_summary: skill.competency_summary
      }
    end
  end
end
