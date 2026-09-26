# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze

  # How an interview ended, in one word the screens can trust. Only a real
  # completion is "completed": an early exit never is, and our failure is "failed".
  OUTCOMES = {
    'all_covered'      => 'completed',
    'time_ceiling'     => 'completed',
    'manual_candidate' => 'ended_early',
    'manual_assessor'  => 'ended_early',
    'error'            => 'failed'
  }.freeze

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true

  before_validation :generate_invite_token, on: :create

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'

  # nil while the interview hasn't ended. An end with no known reason is
  # never called complete.
  def outcome
    return 'failed' if status == 'failed'
    return unless ended?

    OUTCOMES.fetch(end_reason.to_s, 'ended_early')
  end

  # A short reference a candidate can quote to the employer.
  def reference
    "R-#{id}"
  end

  # The link a candidate opens. The page lives in the web app, not in this API.
  # APP_BASE_URL is the old name, still read so existing setups keep working.
  def invite_url
    base = ENV['WEB_APP_URL'].presence || ENV['APP_BASE_URL'].presence || 'http://localhost:5173'
    "#{base.chomp('/')}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
