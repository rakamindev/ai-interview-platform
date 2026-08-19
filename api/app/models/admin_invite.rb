# frozen_string_literal: true

class AdminInvite < ApplicationRecord
  include TenantScoped

  ROLES = %w[admin assessor].freeze

  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }
  validates :invite_token, presence: true, uniqueness: true

  before_validation :generate_invite_token, on: :create
  before_validation :set_default_expiry, on: :create
  before_save :downcase_email

  scope :pending, -> { where(accepted_at: nil).where('expires_at > ?', Time.current) }

  def expired?  = expires_at.past?
  def accepted? = accepted_at.present?
  def usable?   = !expired? && !accepted?

  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:5173')
    "#{base}/admin/setup/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end

  def set_default_expiry
    self.expires_at ||= 48.hours.from_now
  end

  def downcase_email
    self.email = email.downcase
  end
end
