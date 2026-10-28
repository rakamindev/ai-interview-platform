# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  # Portfolios have no tenant_id; they belong to a tenant through their session. Session's
  # TenantScoped default scope is applied inside the join, so during a request this only finds
  # the current tenant's portfolios. Workers run without a tenant and still see every row.
  scope :in_current_tenant, -> { joins(:session) }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  # One attempt can take 4 model calls of up to 180 s each (Faraday retries), about 12 minutes.
  STALE_AFTER = 20.minutes

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
  def in_progress? = %w[pending generating].include?(generation_status)

  # In progress for longer than any attempt can take: the job was lost or the worker died.
  def stale?
    return false unless in_progress?

    started = generation_started_at || session.ended_at
    started.nil? || started < STALE_AFTER.ago
  end
end
