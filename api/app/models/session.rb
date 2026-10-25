# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze

  # F-06: how long the preparing-to-end proof stays valid for the public
  # audio_complete endpoint. Covers the max WS poll (30 × 2s) plus audio queue
  # drain, with generous slack; anything older is treated as not authorized.
  PREPARING_TO_END_WINDOW = 30.minutes

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
    base = ENV.fetch('FRONTEND_BASE_URL', 'http://localhost:5173')
    "#{base}/interview/#{invite_token}"
  end

  # F-06: called by the WebSocket middleware right before signalling the browser
  # that the session is preparing to end. Persists the proof that the coverage
  # verification happened, so the public audio_complete endpoint can check it.
  # update_column intentionally skips callbacks (no tenant context in EM loop).
  def mark_preparing_to_end!
    update_column(:preparing_to_end_at, Time.current)
  end

  # F-06: true only when the WebSocket layer authorized the end AND the proof is
  # still fresh. Stale flags (e.g. leaked token used days later) are rejected.
  def preparing_to_end?
    preparing_to_end_at.present? && preparing_to_end_at >= PREPARING_TO_END_WINDOW.ago
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
