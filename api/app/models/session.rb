# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES    = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error superseded].freeze

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

  def active?      = status == 'active'
  def ended?       = status == 'ended'
  def pending?     = status == 'pending'
  def superseded?  = ended? && end_reason == 'superseded'

  # Primary identity: candidate_id if present, else candidate_email, else nil
  # Name is display-only and must not be used as an identity key.
  def candidate_identity_key
    return "id:#{candidate_id}"    if candidate_id.present?
    return "email:#{candidate_email.downcase.strip}" if candidate_email.present?
    nil
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
