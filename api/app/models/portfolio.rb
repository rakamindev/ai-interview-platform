# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  # Portfolios have no tenant_id; ownership comes from the parent session.
  # Every by-id lookup in a controller must go through this scope.
  scope :for_tenant, ->(tenant_id) { joins(:session).where(sessions: { tenant_id: tenant_id }) }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  # Time of the latest override in this portfolio, or nil.
  def latest_override_at
    assessor_overrides.maximum(:overridden_at)
  end

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
end
