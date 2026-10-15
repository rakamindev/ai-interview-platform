# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze
  # A worker that has held 'generating' this long is assumed dead.
  STALE_GENERATION_AFTER = 10.minutes

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  # Portfolios have no tenant_id of their own; they belong to a tenant through
  # their session, which is tenant-scoped.
  scope :visible_to_current_tenant, -> { where(session_id: Session.select(:id)) }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
  def pending?     = generation_status == 'pending'

  # Atomically moves the portfolio into 'generating'. Returns false when another
  # worker already holds it or it is already complete, so duplicate jobs exit
  # without calling the model.
  def claim_for_generation!
    now = Time.current
    claimed = self.class
                  .where(id:)
                  .where(
                    "generation_status IN ('pending', 'failed') " \
                    "OR (generation_status = 'generating' AND " \
                    "(generation_started_at IS NULL OR generation_started_at < ?))",
                    now - STALE_GENERATION_AFTER
                  )
                  .update_all(generation_status: 'generating', generation_started_at: now, generation_error: nil)

    reload
    claimed == 1
  end
end
