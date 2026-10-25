# frozen_string_literal: true

class OrganizationMembership < ApplicationRecord
  ROLES = %w[admin assessor].freeze

  belongs_to :user
  belongs_to :organization

  validates :role, inclusion: { in: ROLES }
  validates :user_id, uniqueness: { scope: :organization_id, message: 'is already a member of this organization' }

  scope :admins,    -> { where(role: 'admin') }
  scope :assessors, -> { where(role: 'assessor') }

  def admin?    = role == 'admin'
  def assessor? = role == 'assessor'
end
