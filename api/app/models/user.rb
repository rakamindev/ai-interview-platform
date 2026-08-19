# frozen_string_literal: true

class User < ApplicationRecord
  has_secure_password

  # AI-interview users belong to a shared public.organizations tenant. Optional so
  # inert signup accounts (and legacy rows) remain valid; login requires one.
  belongs_to :organization, optional: true

  ROLES = %w[admin user].freeze

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }
  validates :password, length: { minimum: 8 }, allow_nil: true

  before_save :downcase_email

  private

  def downcase_email
    self.email = email.downcase
  end
end
