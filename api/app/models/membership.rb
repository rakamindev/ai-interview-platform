# frozen_string_literal: true

class Membership < ApplicationRecord
  belongs_to :user
  belongs_to :organization

  ROLES = %w[admin assessor user].freeze

  validates :role, inclusion: { in: ROLES }
  validates :user_id, uniqueness: { scope: :organization_id, message: "already has a membership in this organization" }
end
