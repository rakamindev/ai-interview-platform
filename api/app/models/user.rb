# frozen_string_literal: true

class User < ApplicationRecord
  has_secure_password

  # admin          — org owner: manages users, taxonomy, tenant settings
  # assessor       — builds assessments, runs interviews, reviews + overrides
  # hiring_manager — read-only access to results (portfolio, fit/gap, transcript)
  # user           — legacy/no portal access (kept for compatibility with existing rows)
  ROLES = %w[admin assessor hiring_manager user].freeze

  # Roles that may sign in to the assessor portal.
  PORTAL_ROLES = %w[admin assessor hiring_manager].freeze

  # Roles a signup form may request. Admin is granted by seed or by another admin.
  SIGNUP_ROLES = %w[assessor hiring_manager].freeze

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }
  validates :password, length: { minimum: 8 }, if: -> { password.present? }

  before_save :downcase_email

  scope :portal, -> { where(role: PORTAL_ROLES) }

  def portal_access? = PORTAL_ROLES.include?(role)
  def admin?         = role == 'admin'
  def assessor?      = %w[admin assessor].include?(role)
  def read_only?     = role == 'hiring_manager'

  private

  def downcase_email
    self.email = email.downcase
  end
end
