# frozen_string_literal: true

class Candidate < ApplicationRecord
  include TenantScoped

  has_many :sessions, dependent: :nullify
  has_one_attached :cv

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false, scope: :tenant_id },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true

  before_save :downcase_email

  private

  def downcase_email
    self.email = email.downcase
  end
end
