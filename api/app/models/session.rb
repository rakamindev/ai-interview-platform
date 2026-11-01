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

  # WEB_BASE_URL is the origin candidates open in a browser (the React SPA).
  # This is intentionally distinct from APP_BASE_URL, which is the Rails API's
  # own origin — the two are different hosts in any split-service deployment
  # (see assessment/03_defining_problem_and_gap_to_ideal_condition.md, F1).
  def invite_url
    base = ENV.fetch('WEB_BASE_URL') do
      Rails.logger.warn('[Session#invite_url] WEB_BASE_URL is not set — falling back to APP_BASE_URL, ' \
                         'which points at the API and will produce a broken candidate link.')
      ENV.fetch('APP_BASE_URL', 'http://localhost:3001')
    end
    "#{base}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
