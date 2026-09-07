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

  def consented? = candidate_consent.present?

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

  # /interview/:token is a route in the React app, not in this service. Building
  # it from APP_BASE_URL, which api/README.md documents as the *backend* URL,
  # sent every candidate to a Rails routing error that dumped the whole routing
  # table to someone who had not authenticated. One variable was carrying two
  # different meanings; WEB_BASE_URL now carries the one the candidate needs,
  # and falls back to APP_BASE_URL so an existing deployment keeps working.
  def invite_url
    base = ENV['WEB_BASE_URL'].presence ||
           ENV['APP_BASE_URL'].presence ||
           'http://localhost:5173'
    "#{base}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
