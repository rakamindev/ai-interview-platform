# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze
  # generation_error value: the candidate never answered, so there is nothing to assess and retrying cannot help.
  NO_CANDIDATE_ANSWERS = 'no_candidate_answers'
  # Generation takes up to 3 minutes (Portfolios::Generator), so waiting longer than this means something is stuck.
  PROCESSING_DELAY_AFTER = 5.minutes

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
  def no_candidate_answers? = failed? && generation_error == NO_CANDIDATE_ANSWERS

  def processing_delayed?
    return false unless generation_status.in?(%w[pending generating])

    requested_at = generation_requested_at || session.ended_at
    requested_at.present? && requested_at < PROCESSING_DELAY_AFTER.ago
  end
end
