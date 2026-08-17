# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy
  has_one  :candidate_consent, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true

  before_validation :generate_invite_token, on: :create

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }
  scope :reviewed,     -> { where.not(reviewed_at: nil) }
  scope :not_reviewed, -> { where(reviewed_at: nil) }

  def reviewed? = reviewed_at.present?

  # A human signing off that they have looked at this candidate's results.
  # Idempotent on purpose: pressing the button twice must not rewrite the
  # timestamp and make it look like a second, later review happened.
  def mark_reviewed!(user_id)
    return true if reviewed?

    update!(reviewed_at: Time.current, reviewed_by: user_id)
  end

  def unmark_reviewed!
    update!(reviewed_at: nil, reviewed_by: nil)
  end

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'

  # UU PDP gate — an interview may only begin after explicit consent.
  def consent_given?
    candidate_consent&.accepted? == true
  end

  def invite_url
    base = ENV.fetch('WEB_BASE_URL', ENV.fetch('APP_BASE_URL', 'http://localhost:3001'))
    "#{base}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
