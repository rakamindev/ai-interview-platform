# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  CONFIDENCE_LEVELS = %w[high medium low].freeze
  RATING_STATUSES   = %w[assessed not_assessed].freeze
  NOT_ASSESSED_REASONS = %w[not_covered no_level_from_model invalid_level_from_model no_evidence].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy
  # Events are read-only, so they are removed with SQL when the skill is deleted.
  has_many :override_events, -> { order(:created_at, :id) },
           class_name: 'AssessorOverrideEvent', inverse_of: :portfolio_skill, dependent: :delete_all

  scope :for_tenant, lambda { |tenant_id|
    joins(portfolio: :session).where(sessions: { tenant_id: tenant_id })
  }

  validates :skill_label, presence: true
  validates :rating_status, inclusion: { in: RATING_STATUSES }
  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true
  validates :not_assessed_reason, inclusion: { in: NOT_ASSESSED_REASONS }, allow_nil: true
  validates :competency_summary, exclusion: { in: [nil] }
  validate :rating_matches_status

  before_validation :assign_skill_key

  # Stable identity used to update skills in place on regeneration: the skill
  # id when present, otherwise the label lower-cased with spaces collapsed.
  def self.key_for(skill_id:, skill_label:)
    id = skill_id.to_s.strip
    return "id:#{id.downcase}" if id.present?

    "label:#{skill_label.to_s.strip.gsub(/\s+/, ' ').downcase}"
  end

  def assessor_confirmed?
    override_events.last&.action == 'confirm'
  end

  def assessed?     = rating_status == 'assessed'
  def not_assessed? = rating_status == 'not_assessed'

  # evidence is stored as JSONB array of quote strings
  def evidence_quotes
    Array(evidence)
  end

  private

  def assign_skill_key
    self.skill_key = self.class.key_for(skill_id: skill_id, skill_label: skill_label)
  end

  # An assessed skill carries a level and a confidence; a not-assessed skill
  # carries a reason and neither of the two (mirrors a database check).
  def rating_matches_status
    if assessed?
      errors.add(:ai_level, 'is required for an assessed skill') if ai_level.nil?
      errors.add(:ai_confidence, 'is required for an assessed skill') if ai_confidence.nil?
      errors.add(:not_assessed_reason, 'must be empty for an assessed skill') if not_assessed_reason.present?
    elsif not_assessed?
      errors.add(:ai_level, 'must be empty for a not-assessed skill') unless ai_level.nil?
      errors.add(:ai_confidence, 'must be empty for a not-assessed skill') unless ai_confidence.nil?
      errors.add(:not_assessed_reason, 'is required for a not-assessed skill') if not_assessed_reason.blank?
    end
  end
end
