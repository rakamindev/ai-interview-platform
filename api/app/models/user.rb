# frozen_string_literal: true

class User < ApplicationRecord
  has_secure_password

  ROLES = %w[admin user].freeze

  # Deliberately not TenantScoped. Login has to find a user before any tenant
  # is known — that is the whole point of this association — so a default scope
  # reading Current.tenant_id would make authentication circular.
  belongs_to :organization, foreign_key: :tenant_id, inverse_of: false

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }

  before_save :downcase_email

  private

  def downcase_email
    self.email = email.downcase
  end
end
