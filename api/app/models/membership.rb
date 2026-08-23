# frozen_string_literal: true

class Membership < ApplicationRecord
  belongs_to :user
  belongs_to :organization

  ROLES = %w[admin assessor user].freeze

  validates :role, inclusion: { in: ROLES }
  validates :user_id, uniqueness: { scope: :organization_id, message: "already has a membership in this organization" }

  # Effective role for `user_id` within the org matching `scheme`, falling
  # back to `fallback_role` (the account-wide User#role) when no membership
  # row exists for that org — mirrors AuthorizeApiRequest's resolution so
  # login/refresh responses and per-request auth agree on what "role" means.
  def self.effective_role(user_id:, scheme:, fallback_role:)
    return fallback_role if scheme.blank?

    org = Organization.find_by(scheme: scheme)
    return fallback_role unless org

    find_by(user_id: user_id, organization_id: org.id)&.role || fallback_role
  end
end
