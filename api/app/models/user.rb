# frozen_string_literal: true

class User < ApplicationRecord
  has_secure_password

  ROLES = %w[admin user].freeze

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP },
                    length: { maximum: 255 }
  validates :password, length: { minimum: 8 }, if: -> { password.present? }

  before_save :downcase_email

  private

  def downcase_email
    self.email = email.downcase
  end
end
