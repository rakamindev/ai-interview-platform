# frozen_string_literal: true

# Reusable custom skill owned by a tenant. Skills added while building an
# assessment are persisted here so they appear in the picker of future
# assessments (and vacancies) of the same tenant.
class CustomSkill < ApplicationRecord
  include TenantScoped

  validates :skill_label, presence: true,
                          uniqueness: { scope: :tenant_id, case_sensitive: false }
  validates :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor, presence: true
  validates :created_by, presence: true
end
