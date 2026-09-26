# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  # model_unavailable      — the AI call failed (timeout, rate limit, server error, 404)
  # model_response_invalid — the AI answered, but not in a form we can use
  # no_interview_data      — the interview has no transcript, so there is nothing to rate
  FAILURE_KINDS = %w[model_unavailable model_response_invalid no_interview_data].freeze

  # A job that has held a report this long without finishing has stopped.
  STALL_AFTER = 5.minutes

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :failure_kind, inclusion: { in: FAILURE_KINDS }, allow_nil: true

  # Also on create: the database default fills the column, but Rails doesn't
  # read it back, so the new object would hold nil.
  before_save :stamp_status_change, if: -> { new_record? || will_save_change_to_generation_status? }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def pending?     = generation_status == 'pending'
  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'

  # Takes the report for one job, in a single database update, so two jobs
  # can never work on it at once. Returns false when another job has it, or
  # when there is nothing to do. A job that stopped can be taken over.
  def claim!
    now = Time.current
    claimed = self.class
                  .where(id: id)
                  .where("generation_status IN ('pending', 'failed') " \
                         "OR (generation_status = 'generating' AND status_changed_at < ?)", now - STALL_AFTER)
                  .update_all(generation_status: 'generating', status_changed_at: now)
    reload
    claimed == 1
  end

  # A temporary problem: the job queue will try again, so the report waits.
  def retry_later!(kind, message)
    update!(generation_status: 'pending', failure_kind: kind, generation_error: message)
  end

  def fail!(kind, message)
    update!(generation_status: 'failed', failure_kind: kind, generation_error: message)
  end

  private

  def stamp_status_change
    self.status_changed_at = Time.current
  end
end
