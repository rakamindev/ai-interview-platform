# frozen_string_literal: true

class User < ApplicationRecord
  has_secure_password

  ROLES = %w[admin user].freeze

  # F-03 phase 2: ownership relation — every user belongs to exactly one
  # organization. Login derives the tenant scheme from this association, so
  # tenancy is verified by data, not by anything typed at the login form.
  belongs_to :organization, foreign_key: :tenant_id
  has_many :administrator_invitations,
           foreign_key: :inviter_id,
           inverse_of: :inviter,
           dependent: :restrict_with_exception

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }

  # Password policy (UI enhancement, Pilar 4): 8–72 characters.
  # `allow_nil: true` keeps existing users valid on attribute updates that do
  # not change the password — the policy only applies to newly set passwords
  # (NIST 800-63B guidance: length over complexity; 72 = bcrypt input limit).
  validates :password, length: { in: 8..72, message: 'must be between 8 and 72 characters' },
                       allow_nil: true

  before_save :downcase_email

  private

  def downcase_email
    self.email = email.downcase
  end
end
