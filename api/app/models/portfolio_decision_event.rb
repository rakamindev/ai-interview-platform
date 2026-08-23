# frozen_string_literal: true

class PortfolioDecisionEvent < ApplicationRecord
  EVENT_TYPES = %w[ai_recommended admin_finalized admin_reopened].freeze

  belongs_to :portfolio_decision
  belongs_to :actor, class_name: 'User', optional: true

  attr_readonly :portfolio_decision_id, :event_type, :outcome, :note, :actor_id, :created_at

  before_update :prevent_mutation
  before_destroy :prevent_destruction

  validates :event_type, inclusion: { in: EVENT_TYPES }
  validates :outcome, inclusion: { in: PortfolioDecision::OUTCOMES }, allow_nil: true
  validates :note, presence: true, if: :admin_reopened?
  validates :actor_id, presence: true, unless: :ai_recommended?
  validates :actor_id, absence: true, if: :ai_recommended?

  def ai_recommended?
    event_type == 'ai_recommended'
  end

  def admin_reopened?
    event_type == 'admin_reopened'
  end

  private

  def prevent_mutation
    errors.add(:base, 'Decision audit events are immutable')
    throw(:abort)
  end

  def prevent_destruction
    errors.add(:base, 'Decision audit events cannot be deleted')
    throw(:abort)
  end
end
