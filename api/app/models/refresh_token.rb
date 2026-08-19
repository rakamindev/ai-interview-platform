# frozen_string_literal: true

class RefreshToken < ApplicationRecord
  GRACE_PERIOD = 5.seconds

  belongs_to :user

  validates :user_id, presence: true
  validates :token_hash, presence: true
  validates :expires_at, presence: true

  scope :active, -> { where(revoked_at: nil).where("expires_at > ?", Time.current) }
  scope :expired, -> { where("expires_at <= ?", Time.current) }
  scope :revoked, -> { where.not(revoked_at: nil) }

  def revoke!
    update!(revoked_at: Time.current)
  end

  def mark_used!
    update!(used_at: Time.current)
  end

  def grace_period_expired?
    used_at.present? && used_at < GRACE_PERIOD.ago
  end

  def valid_token?
    active? || (used_at.present? && !grace_period_expired?)
  end

  def self.revoke_all_for_user(user_id)
    active.where(user_id: user_id).update_all(revoked_at: Time.current)
  end

  def self.find_by_token_hash(hash)
    find_by(token_hash: hash)
  end

  def self.cleanup
    expired.delete_all
    revoked.where("revoked_at < ?", 7.days.ago).delete_all
  end
end
