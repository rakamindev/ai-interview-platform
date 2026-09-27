
# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES = %w[pending active ended failed].freeze
  END_REASONS = %w[
    manual_candidate
    manual_assessor
    all_covered
    time_ceiling
    error
  ].freeze

  HIRING_DECISIONS = %w[
  under_review
  accepted
  rejected
].freeze

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one :portfolio, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true

  validates :candidate_email,
            format: {
              with: URI::MailTo::EMAIL_REGEXP,
              message: "is not a valid email address"
            },
            allow_blank: true

  validate :expires_at_must_be_in_future, on: :create
  validates :hiring_decision,
          inclusion: { in: HIRING_DECISIONS }

validates :decision_notes,
          length: { maximum: 2000 },
          allow_blank: true

  before_validation :generate_invite_token, on: :create
  before_validation :normalize_candidate_email

  scope :active, -> { where(status: "active") }
  scope :pending, -> { where(status: "pending") }
  scope :ended, -> { where(status: "ended") }

  def active? = status == "active"
  def ended? = status == "ended"
  def pending? = status == "pending"

    def interview_completed?
  ended? && end_reason != "error"
end

  def invitation_expired?
    pending? &&
      expires_at.present? &&
      expires_at <= Time.current
  end

  def invitation_valid?
    pending? && !invitation_expired?
  end

  def invite_url
    base = ENV.fetch(
      "APP_BASE_URL",
      "http://localhost:3001"
    )

    "#{base}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end

  def normalize_candidate_email
    return if candidate_email.blank?

    self.candidate_email = candidate_email.strip.downcase
  end

  def expires_at_must_be_in_future
    return if expires_at.blank?
    return if expires_at.future?

    errors.add(
      :expires_at,
      "must be in the future"
    )
  end
end
