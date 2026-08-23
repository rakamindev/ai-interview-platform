# frozen_string_literal: true

class PortfolioDecision < ApplicationRecord
  OUTCOMES = %w[pass fail].freeze

  belongs_to :portfolio
  belongs_to :finalized_by, class_name: 'User', optional: true
  has_many :portfolio_decision_events, dependent: :restrict_with_error

  attr_readonly :portfolio_id, :ai_outcome, :ai_rationale, :ai_recommended_at

  validates :ai_outcome, inclusion: { in: OUTCOMES }, allow_nil: true
  validates :final_outcome, inclusion: { in: OUTCOMES }, allow_nil: true
  validates :ai_rationale, presence: true, if: :ai_outcome?
  validate :ai_recommendation_fields_are_complete
  validate :finalization_fields_are_complete

  def finalized?
    final_outcome.present?
  end

  def ai_recommendation_available?
    ai_outcome.present?
  end

  def effective_outcome
    final_outcome || ai_outcome
  end

  def status
    return 'finalized' if finalized?
    return 'ai_recommended' if ai_recommendation_available?

    'unavailable'
  end

  def source
    return 'admin' if finalized?
    return 'ai' if ai_recommendation_available?

    nil
  end

  private

  def ai_recommendation_fields_are_complete
    values = [ai_outcome, ai_rationale, ai_recommended_at]
    return if values.all?(&:blank?) || values.none?(&:blank?)

    errors.add(:base, 'AI recommendation fields must be set together')
  end

  def finalization_fields_are_complete
    values = [final_outcome, finalized_by_id, finalized_at]
    return if values.all?(&:blank?) || values.none?(&:blank?)

    errors.add(:base, 'Finalization outcome, actor, and timestamp must be set together')
  end
end
