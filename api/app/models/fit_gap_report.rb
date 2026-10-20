# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  GENERATION_STATUSES = %w[generating complete].freeze

  # A claim older than this is taken to belong to a job that died, so the next request may take it over.
  # Longer than a job and its two Sidekiq retries.
  CLAIM_STALE_AFTER = 10.minutes

  belongs_to :portfolio
  belongs_to :vacancy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :skill_comparisons, presence: true, if: :complete?

  scope :complete, -> { where(generation_status: 'complete') }

  # Claims generation of the report for one portfolio and vacancy (P1-6). Returns true when the caller now holds
  # the claim and should queue the job, false when another request already holds it. The unique index on
  # (portfolio_id, vacancy_id) is the lock: of two concurrent inserts one fails. A stale claim, or with
  # replace: true a finished report, is taken over by a conditional update, which Postgres lets only one caller win.
  def self.claim(portfolio_id:, vacancy_id:, replace: false)
    transaction(requires_new: true) do
      create!(portfolio_id:, vacancy_id:, generation_status: 'generating', requested_at: Time.current,
              skill_comparisons: [])
    end
    true
  rescue ActiveRecord::RecordNotUnique
    row = where(portfolio_id:, vacancy_id:)
    takeover = row.where(generation_status: 'generating')
                  .where('requested_at IS NULL OR requested_at < ?', CLAIM_STALE_AFTER.ago)
    takeover = takeover.or(row.complete) if replace
    takeover.update_all(generation_status: 'generating', requested_at: Time.current).positive?
  end

  def complete?
    generation_status == 'complete'
  end
end
