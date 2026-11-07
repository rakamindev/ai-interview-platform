# frozen_string_literal: true

# One attempt to score a portfolio. Generations are never deleted or rewritten into each other:
# a portfolio points at the one that is currently published (Portfolio#current_generation).
#
# Lifecycle:
#   queued ─claim─▶ running ─valid output, newer than current─▶ succeeded (published)
#                     │      └─valid output, older than current─▶ superseded (kept, never published)
#                     ├─transient error─▶ retrying ─claim─▶ running …
#                     └─permanent error / retries exhausted─▶ failed
class PortfolioGeneration < ApplicationRecord
  STATUSES  = %w[queued running retrying succeeded failed superseded].freeze
  TERMINAL  = %w[succeeded failed superseded].freeze
  IN_FLIGHT = %w[queued running].freeze
  # A run stuck in "running" this long (worker killed mid-call) may be claimed again by a retry.
  STALE_RUNNING_AFTER = 10.minutes

  belongs_to :portfolio
  has_many :portfolio_skills, foreign_key: :generation_id, inverse_of: :generation, dependent: :destroy

  validates :status, inclusion: { in: STATUSES }
  validates :sequence, numericality: { only_integer: true, greater_than: 0 }

  # Runs that still block a new assessor request. A "running" run older than STALE_RUNNING_AFTER
  # is assumed to belong to a worker that died (Sidekiq OSS drops a job if its process is killed),
  # so it no longer blocks; if its job does come back, publication rules still protect the result.
  scope :blocking_new_requests, lambda {
    where(status: 'queued')
      .or(where(status: 'running').where('started_at IS NULL OR started_at >= ?', STALE_RUNNING_AFTER.ago))
  }

  def terminal?  = TERMINAL.include?(status)
  def in_flight? = IN_FLIGHT.include?(status)
end
