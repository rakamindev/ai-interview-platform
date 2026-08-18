# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed expired].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze
  # Default masa aktif link: dapat di-override lewat ENV untuk testing (misal: 5 menit)
  # Default jika ENV tidak diset: 7 hari
  DEFAULT_EXPIRY = ENV.fetch('INVITE_EXPIRY_MINUTES', 7 * 24 * 60).to_i.minutes

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true

  before_validation :generate_invite_token, on: :create
  before_validation :set_default_expiry, on: :create

  scope :active_link, -> { where(status: 'pending').where('expires_at > ?', Time.current) }
  scope :expired,     -> { where(status: 'expired').or(where(status: 'pending').where('expires_at <= ?', Time.current)) }

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }

  def expired?
    status == 'expired' || (status == 'pending' && expires_at.present? && Time.current >= expires_at)
  end

  def link_accessible?
    !expired? && !ended? && !failed?
  end

  # Returns 'expired' and auto-syncs DB if link has passed expiry time
  def current_status
    if status == 'pending' && expires_at.present? && Time.current >= expires_at
      update_column(:status, 'expired') if persisted?
      'expired'
    else
      status
    end
  end

  def extend_expiry!(duration = DEFAULT_EXPIRY)
    new_expiry = [expires_at || Time.current, Time.current].max + duration
    update!(expires_at: new_expiry, status: 'pending')
  end

  def regenerate_token!(duration = DEFAULT_EXPIRY)
    update!(
      invite_token: SecureRandom.hex(32),
      expires_at:   Time.current + duration,
      status:       'pending'
    )
  end

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'
  def failed?  = status == 'failed'

  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:5173')
    "#{base}/interview/#{invite_token}"
  end

  private

  def set_default_expiry
    self.expires_at ||= DEFAULT_EXPIRY.from_now
  end

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
