# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = FitGap::Comparator::RESULTS
  STATUSES = %w[pending generating complete failed].freeze
  IN_FLIGHT_STATUSES = %w[pending generating].freeze
  NARRATIVE_SOURCES = %w[ai fallback].freeze

  # A job that has been "generating" for longer than this is assumed dead
  # (worker killed, deploy) and may be claimed by another job.
  GENERATION_LEASE = 5.minutes

  belongs_to :portfolio
  belongs_to :vacancy

  validates :status, inclusion: { in: STATUSES }
  validates :narrative_source, inclusion: { in: NARRATIVE_SOURCES }, allow_nil: true
  validate :skill_comparisons_is_an_array

  def pending?    = status == 'pending'
  def generating? = status == 'generating'
  def complete?   = status == 'complete'
  def failed?     = status == 'failed'
  def in_flight?  = IN_FLIGHT_STATUSES.include?(status)

  def generation_lease_expired?(now = Time.current)
    generation_started_at.nil? || generation_started_at < now - GENERATION_LEASE
  end

  def queue_lease_expired?(now = Time.current)
    queued_at.nil? || queued_at < now - GENERATION_LEASE
  end

  private

  def skill_comparisons_is_an_array
    errors.add(:skill_comparisons, 'must be an array') unless skill_comparisons.is_a?(Array)
  end
end
