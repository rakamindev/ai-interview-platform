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

  def invite_url
    frontend_base = ENV['FRONTEND_URL'].presence ||
                    (ENV['ALLOWED_ORIGINS'].present? && !ENV['ALLOWED_ORIGINS'].include?('*') ? ENV['ALLOWED_ORIGINS'].split(',').first.strip : nil) ||
                    'http://localhost:5173'
    "#{frontend_base}/interview/#{invite_token}"
  end

  def grant_consent!(locale: 'id')
    update!(
      candidate_consent: true,
      consented_at:      Time.current,
      consent_locale:    locale.to_s
    )
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
