# frozen_string_literal: true

class CoverageMap < ApplicationRecord
  include TenantScoped

  STATES = %w[not_yet initiated partial covered].freeze

  belongs_to :session

  validates :skill_label, presence: true
  validates :state, inclusion: { in: STATES }
  validates :probe_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :configured,  -> { where(is_discovered: false) }
  scope :discovered,  -> { where(is_discovered: true) }

  private

  # See Portfolio#assign_tenant_id — must be `=`, not `||=`, because Rails
  # pre-populates tenant_id from the active default_scope before this runs.
  def assign_tenant_id
    self.tenant_id = session&.tenant_id
  end
end
