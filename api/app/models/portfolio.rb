# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  # A portfolio that stays 'pending' or 'generating' longer than this has almost
  # certainly lost its job (queue outage, killed worker).
  STALE_AFTER = 10.minutes

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  before_save :stamp_status_change, if: -> { new_record? || generation_status_changed? }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
  def pending?     = generation_status == 'pending'

  # Computed on read, never stored. An unknown age (missing timestamp) counts as stale.
  def stale?
    in_progress = pending? || generating?
    in_progress && (status_changed_at.nil? || status_changed_at < STALE_AFTER.ago)
  end

  def regenerable? = failed? || stale?

  private

  def stamp_status_change
    self.status_changed_at = Time.current
  end
end
