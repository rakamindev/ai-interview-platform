# frozen_string_literal: true

# Represents one candidate interview attempt and its generated invitation.
class Session < ApplicationRecord
  include TenantScoped

  STATUSES = %w[pending active ended failed].freeze
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

  # Makes connection_id the only audio connection allowed to act for this session.
  # Takes the row lock so it cannot interleave with EndHandler. Returns false if the session already ended.
  def claim_audio_connection!(connection_id)
    with_lock do
      next false if ended?

      update_column(:active_connection_id, connection_id)
      true
    end
  end

  # True when a finished result exists but coverage analysis recorded nothing, so its levels and confidence were
  # produced without coverage data. Works on preloaded associations, so lists do not query per session.
  def coverage_missing?
    return false unless ended? && portfolio&.complete?

    coverage_maps.none? { |map| map.probe_count.positive? }
  end

  def invite_url
    "#{Rails.configuration.x.web_base_url}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
