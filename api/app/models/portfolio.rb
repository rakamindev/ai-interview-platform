# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  # A portfolio left in a non-terminal state (pending/generating) past this TTL
  # is assumed to have lost its generation job and becomes eligible for recovery.
  # Gemini calls time out at 180s and Sidekiq retries retire fast, so 15 minutes
  # is a wide margin that cannot false-positive on a legitimately running job.
  GENERATION_RECOVERY_TTL_MINUTES = 15

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :pending,     -> { where(generation_status: 'pending') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def pending?     = generation_status == 'pending'
  def failed?      = generation_status == 'failed'
end
