# frozen_string_literal: true

class User < ApplicationRecord
  has_secure_password

  ROLES = %w[admin user].freeze

  # Deliberately not `include TenantScoped`: that concern's default_scope
  # reads Current.tenant_id, which isn't resolvable yet at the moment we're
  # looking a user up to *establish* Current.tenant_id at login.
  belongs_to :organization, foreign_key: :tenant_id

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }
  validates :tenant_id, presence: true

  before_save :downcase_email

  private

  def downcase_email
    self.email = email.downcase
  end
end
