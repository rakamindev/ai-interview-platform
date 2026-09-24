# frozen_string_literal: true

class TenantMembership < ApplicationRecord
  ROLES = %w[admin assessor user].freeze

  belongs_to :user
  belongs_to :organization

  validates :role, inclusion: { in: ROLES }
  validates :organization_id, uniqueness: { scope: :user_id }

  scope :active, -> { where(active: true) }
end
