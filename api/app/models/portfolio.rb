# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'

  # Assessment-configured skills that Gemini did not return a rating for
  # (ambiguous transcript coverage, model omission, etc). The DB has no
  # concept of "unassessed" — this reconciles at read time instead of
  # persisting placeholder rows.
  def missing_configured_skills
    return AssessmentSkill.none unless complete?

    configured      = session.assessment.assessment_skills.order(:display_order)
    assessed        = portfolio_skills.where(is_discovered: false)
    assessed_ids    = assessed.pluck(:skill_id).compact
    assessed_labels = assessed.pluck(:skill_label).map(&:downcase)

    configured.reject do |skill|
      (skill.skill_id.present? && assessed_ids.include?(skill.skill_id)) ||
        assessed_labels.include?(skill.skill_label.downcase)
    end
  end
end
