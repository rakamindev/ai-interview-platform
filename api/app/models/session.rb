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

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'
  def consented? = consented_at.present?

  def record_consent!(ip:, version: '2026.1')
    update!(
      consented_at:  Time.current,
      consent_ip:    ip,
      terms_version: version
    )
  end

  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:3001')
    "#{base}/interview/#{invite_token}"
  end

  def remaining_seconds
    return 0 if ended?

    target_assessment = assessment || Assessment.unscoped.find_by(id: assessment_id)
    return unless target_assessment&.time_limit_min

    limit = target_assessment.time_limit_min * 60
    return limit unless started_at

    [(limit - (Time.current - started_at)).to_i, 0].max
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
