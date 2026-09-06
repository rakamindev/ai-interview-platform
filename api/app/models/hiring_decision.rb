# frozen_string_literal: true

class HiringDecision < ApplicationRecord
  include TenantScoped

  DECISIONS = %w[advance hold reject].freeze

  belongs_to :portfolio
  belongs_to :decider, class_name: 'User', foreign_key: 'decided_by', optional: true

  validates :decision, inclusion: { in: DECISIONS, message: 'must be one of: advance, hold, reject' }
  validates :rationale, presence: true, length: {
    minimum: 20,
    message: 'must be at least 20 characters to ensure accountability'
  }
  validates :portfolio_id, uniqueness: {
    message: 'already has an immutable hiring decision'
  }
  validates :decided_by, presence: true

  # Append-only audit trail — update TIDAK diperbolehkan
  before_update do
    raise ActiveRecord::ReadOnlyRecord,
          'Hiring decisions are immutable after creation. Create an audit log entry instead.'
  end
end
