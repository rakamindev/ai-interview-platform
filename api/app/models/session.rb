# frozen_string_literal: true

require 'digest'

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze
  CONSENT_STATUSES = %w[none given revoked].freeze
  CONSENT_VERSION = 'v1'

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true
  validates :consent_status, inclusion: { in: CONSENT_STATUSES }
  validates :consent_version, presence: true, if: :consent_given?

  before_validation :generate_invite_token, on: :create

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'

  def consent_given?  = consent_status == 'given'
  def consent_revoked? = consent_status == 'revoked'

  # Records explicit consent. Returns false if the session already ended.
  # Idempotent: granting again when already given is a no-op (keeps original timestamps).
  def grant_consent!(version: CONSENT_VERSION, consent_text: nil)
    return false if ended?
    return true if consent_given?

    update!(
      consent_status: 'given',
      consent_version: version,
      consented_at: Time.current,
      consent_revoked_at: nil,
      consent_text_hash: consent_text ? Digest::SHA256.hexdigest(consent_text) : consent_text_hash
    )
    true
  end

  # Records consent withdrawal before the interview. After a session has ended,
  # revocation belongs to the DSAR/erasure flow, not here.
  def revoke_consent!
    return false if ended?

    update!(consent_status: 'revoked', consent_revoked_at: Time.current)
    true
  end

  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:3001')
    "#{base}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
