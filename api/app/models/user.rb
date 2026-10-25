# frozen_string_literal: true

class User < ApplicationRecord
  has_secure_password

  ROLES = %w[admin user].freeze

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, inclusion: { in: ROLES }

  has_many :organization_memberships, dependent: :destroy
  has_many :organizations, through: :organization_memberships

  before_save :downcase_email

  def role_in(organization)
    organization_id = organization.is_a?(Organization) ? organization.id : organization
    organization_memberships.find_by(organization_id: organization_id)&.role
  end

  def member_of?(organization)
    organization_id = organization.is_a?(Organization) ? organization.id : organization
    organization_memberships.exists?(organization_id: organization_id)
  end

  private

  def downcase_email
    self.email = email.downcase
  end
end
