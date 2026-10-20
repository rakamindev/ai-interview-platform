# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze
  CONSENT_VERSION = 'v1'

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true

  before_validation :generate_invite_token, on: :create

  def pending? = status == 'pending'
  def active? = status == 'active'
  def ended? = status == 'ended'
  def failed? = status == 'failed'
  def consent_accepted? = consent_accepted_at.present? && consent_version == CONSENT_VERSION
  def consent_declined? = consent_declined_at.present?

  def invite_url
    base_url = ENV.fetch('CANDIDATE_APP_URL', 'http://localhost:5173').sub(%r{/\z}, '')
    "#{base_url}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
