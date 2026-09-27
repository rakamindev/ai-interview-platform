# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze
  FAILURE_MESSAGES = {
    'assessment_invalid' => 'Assessment needs fixing',
    'start_failed' => "Couldn't start due to a system error",
    'candidate_disconnected' => 'Candidate disconnected',
    'ai_connection_lost' => 'AI interviewer connection lost'
  }.freeze

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true
  validates :failure_code, inclusion: { in: FAILURE_MESSAGES.keys }, allow_nil: true

  before_validation :generate_invite_token, on: :create

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'

  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:3001')
    "#{base}/interview/#{invite_token}"
  end

  def record_failure!(code, detail = nil)
    update!(failure_code: code, failure_detail: detail&.truncate(255), failed_at: Time.current)
  end

  def clear_failure!
    update!(failure_code: nil, failure_detail: nil, failed_at: nil)
  end

  def failure_message
    return if failure_code.blank?

    "#{[FAILURE_MESSAGES.fetch(failure_code), failure_detail && "(#{failure_detail})"].compact.join(' ')}."
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
