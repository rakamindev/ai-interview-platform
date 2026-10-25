# frozen_string_literal: true

require 'digest'

class AdministratorInvitation < ApplicationRecord
  belongs_to :organization, foreign_key: :tenant_id
  belongs_to :inviter, class_name: 'User'

  validates :recipient_email, presence: true,
                              format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :token_digest, presence: true,
                           length: { is: 64 },
                           uniqueness: true
  validates :expires_at, presence: true
  validate :expires_after_creation, on: :create
  validate :single_terminal_state

  before_validation :normalize_recipient_email

  scope :for_tenant, ->(tenant_id) { where(tenant_id:) }
  scope :recent_first, -> { order(created_at: :desc) }

  def self.normalize_email(email)
    email.to_s.strip.downcase
  end

  def self.digest_token(token)
    Digest::SHA256.hexdigest(token.to_s)
  end

  def active?
    accepted_at.nil? && revoked_at.nil? && expires_at.present? && expires_at.future?
  end

  def status
    return 'accepted' if accepted_at.present?
    return 'revoked' if revoked_at.present?
    return 'expired' if expires_at.blank? || expires_at.past?

    'active'
  end

  private

  def normalize_recipient_email
    self.recipient_email = self.class.normalize_email(recipient_email)
  end

  def expires_after_creation
    return if expires_at.blank? || expires_at.future?

    errors.add(:expires_at, 'must be in the future')
  end

  def single_terminal_state
    return unless accepted_at.present? && revoked_at.present?

    errors.add(:base, 'an invitation cannot be accepted and revoked')
  end
end
