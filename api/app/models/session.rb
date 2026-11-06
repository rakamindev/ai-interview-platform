# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze

  # Candidate invite links are deliberately short-lived. The window is long
  # enough to schedule an interview, short enough that a leaked link stops
  # working on its own. Override per environment with INVITE_TTL_HOURS.
  DEFAULT_INVITE_TTL_HOURS = 72

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :invite_expires_at, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true
  validates :invite_reissued_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  before_validation :generate_invite_token, on: :create
  before_validation :set_invite_expiry,    on: :create

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }

  def self.invite_ttl_hours
    hours = ENV.fetch('INVITE_TTL_HOURS', DEFAULT_INVITE_TTL_HOURS).to_i
    hours.positive? ? hours : DEFAULT_INVITE_TTL_HOURS
  end

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'
  def failed?  = status == 'failed'

  def invite_expired?
    invite_expires_at.present? && invite_expires_at <= Time.current
  end

  def invite_revoked?
    invite_revoked_at.present?
  end

  # A link is consumed once the interview is finished. An active session keeps
  # its status (so the assessor can see "Live") but the invite itself is no
  # longer a fresh link.
  def invite_consumed?
    ended? || failed?
  end

  def invite_usable?
    pending? && !invite_expired? && !invite_revoked?
  end

  # Single source of truth for what the candidate and the assessor see.
  # Returns one of: pending, active, completed, expired, revoked.
  def invite_status
    return 'revoked'   if invite_revoked?
    return 'expired'   if invite_expired?
    return 'completed' if invite_consumed?

    status
  end

  def revoke_invite!
    update!(invite_revoked_at: Time.current)
  end

  # Rotates the token instead of just extending the old one, so a leaked link
  # stays dead after a reissue.
  def reissue_invite!
    update!(
      invite_token:          SecureRandom.hex(32),
      invite_expires_at:     self.class.invite_ttl_hours.hours.from_now,
      invite_revoked_at:     nil,
      invite_reissued_count: invite_reissued_count + 1
    )
  end

  def record_consent!
    update!(consent_given_at: Time.current) if consent_given_at.nil?
    consent_given_at
  end

  # Candidate-facing URL. This is the web app, not the API: /interview/:token
  # is a React route. Using APP_BASE_URL (the API origin) produced a 404 link.
  def invite_url
    base = ENV['WEB_BASE_URL'].presence || ENV['CANDIDATE_BASE_URL'].presence || 'http://localhost:5173'
    "#{base.to_s.chomp('/')}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end

  def set_invite_expiry
    self.invite_expires_at ||= self.class.invite_ttl_hours.hours.from_now
  end
end
