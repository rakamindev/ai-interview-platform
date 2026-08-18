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

  # One unused invite per person: reuse pending by candidate_id, then by name.
  # Unnamed invites are never reused — each is a distinct session.
  def self.pending_invite_for(assessment, candidate_id: nil, candidate_name: nil)
    relation = assessment.sessions.pending.order(created_at: :desc)

    if candidate_id.present?
      found = relation.find_by(candidate_id: candidate_id)
      return found if found
    end

    name = candidate_name.to_s.strip
    return nil if name.blank?

    relation.where("LOWER(BTRIM(candidate_name)) = ?", name.downcase).first
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
