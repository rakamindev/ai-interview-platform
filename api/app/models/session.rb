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
  before_validation :set_invite_expiry, on: :create

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'

  # Expiry only gates *starting* an interview, never continuing one.
  # A session that has already moved past `pending` is never considered
  # expired, regardless of wall-clock time.
  def invite_expired?
    pending? && invite_expires_at.present? && invite_expires_at.past?
  end

  def extend_invite!
    update!(invite_expires_at: Time.current + Session.invite_token_ttl)
  end

  def invite_url
    base = ENV.fetch('CANDIDATE_APP_URL', 'http://localhost:5173')
    "#{base}/interview/#{invite_token}"
  end

  def self.invite_token_ttl
    ENV.fetch('INVITE_TOKEN_TTL_HOURS', 72).to_i.hours
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end

  def set_invite_expiry
    self.invite_expires_at ||= Time.current + Session.invite_token_ttl
  end
end
