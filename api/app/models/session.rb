# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy
  has_one  :consent, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true

  before_validation :generate_invite_token, on: :create

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }
  scope :expired_for_purge, -> { where(data_purged_at: nil).where.not(expires_at: nil).where('expires_at <= ?', Time.current) }

  PURGED_NAME_MARKER = '[deleted]'
  PURGED_TEXT_MARKER = '[deleted]'

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'

  def consent_given? = consent&.given == true
  def data_purged?   = data_purged_at.present?
  def transcript_capture_failed? = transcript_capture_failed_at.present?

  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:3001')
    "#{base}/interview/#{invite_token}"
  end

  # Removes the candidate's personal data (name, transcript text) while
  # keeping the portfolio's verdict/skill scores — the hiring record survives,
  # the personal data doesn't. Used by both the retention purge task and the
  # candidate-initiated deletion endpoint. Idempotent.
  def purge_personal_data!
    return if data_purged?

    transaction do
      update!(candidate_name: PURGED_NAME_MARKER, data_purged_at: Time.current)
      # `each` + `update!`, not `update_all` — the latter bypasses the
      # `encrypts :text` attribute type and would write the marker as raw
      # plaintext, inconsistent with every other value in the column.
      transcript_turns.find_each { |turn| turn.update!(text: PURGED_TEXT_MARKER) }
    end
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
