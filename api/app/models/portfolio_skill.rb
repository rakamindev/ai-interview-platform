# frozen_string_literal: true

class PortfolioSkill < ApplicationRecord
  include SessionTenantScoped

  CONFIDENCE_LEVELS = %w[high medium low].freeze

  # A portfolio row now carries *why* it has no rating, not just the absence of
  # one. Before this existed the only representable outcome was a number, so a
  # skill nobody probed was recorded as L1.
  ASSESSED             = 'assessed'
  INSUFFICIENT_EVIDENCE = 'insufficient_evidence'
  NOT_PROBED           = 'not_probed'
  ASSESSMENT_STATES    = [ASSESSED, INSUFFICIENT_EVIDENCE, NOT_PROBED].freeze

  belongs_to :portfolio
  has_one :assessor_override, dependent: :destroy

  scoped_to_tenant_through portfolio: :session

  before_validation :normalise_skill_label

  validates :skill_label, presence: true
  validates :assessment_state, inclusion: { in: ASSESSMENT_STATES }
  validates :competency_summary, presence: true

  validates :ai_level, numericality: { only_integer: true, in: 1..5 }, allow_nil: true
  validates :ai_confidence, inclusion: { in: CONFIDENCE_LEVELS }, allow_nil: true

  # Mirrors the database check constraint. Duplicated deliberately: the DB is
  # the guarantee, this is the readable error.
  validate :rating_agrees_with_state

  scope :assessed,   -> { where(assessment_state: ASSESSED) }
  scope :unassessed, -> { where.not(assessment_state: ASSESSED) }
  scope :live,       -> { where(superseded_at: nil) }

  def assessed?   = assessment_state == ASSESSED
  def unassessed? = !assessed?
  def superseded? = superseded_at.present?

  # What the assessor's decision should actually be based on: their own rating
  # if they made one, otherwise the model's. Nil when nothing was assessed —
  # callers must handle that rather than defaulting to a number.
  def effective_level
    assessor_override&.override_level || ai_level
  end

  def overridden? = assessor_override.present?

  # evidence is a JSONB array of quote strings. A model that returns an object
  # here previously produced `[[key, value]]` pairs rendered to assessors as
  # candidate quotes.
  def evidence_quotes
    return [] unless evidence.is_a?(Array)

    evidence.select { |quote| quote.is_a?(String) }
  end

  private

  def normalise_skill_label
    self.skill_label = skill_label.strip if skill_label.is_a?(String)
  end

  def rating_agrees_with_state
    if assessed?
      errors.add(:ai_level, 'must be present when the skill is assessed') if ai_level.nil?
      errors.add(:ai_confidence, 'must be present when the skill is assessed') if ai_confidence.nil?
    else
      errors.add(:ai_level, "must be absent when the skill is #{assessment_state}") if ai_level.present?
      errors.add(:ai_confidence, "must be absent when the skill is #{assessment_state}") if ai_confidence.present?
    end
  end
end
