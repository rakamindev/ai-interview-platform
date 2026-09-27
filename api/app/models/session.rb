# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze

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
  scope :failed,  -> { where(status: 'failed') }

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'
  def failed?  = status == 'failed'

  # Both are terminal for the candidate: the audio WS must not re-accept them.
  # (A pre-first-turn failure is reset to `pending` instead — see Sessions::FailureHandler.)
  def terminal? = ended? || failed?

  # Candidates open this in a browser; /interview/:token is a web-app route, not an API route.
  def invite_url
    base = ENV.fetch('FRONTEND_BASE_URL', 'http://localhost:5173').chomp('/')
    "#{base}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
