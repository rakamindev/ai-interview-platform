# frozen_string_literal: true

# Read-only reference to the existing rakamin-api organizations table.
# Lives in the PostgreSQL public schema (excluded from Apartment in rakamin-api).
# We connect to the same DB so this table is directly accessible.
#
# Only includes the fields we need for tenant resolution.
class Organization < ApplicationRecord
  self.table_name = "organizations"

  has_many :memberships, dependent: :destroy

  # Mirrors rakamin-api Organisation.identify exactly.
  # Accepts identifier, name, scheme, or host.
  # Returns nil instead of falling back to tenant 0 — a silent fallback to
  # an unrecognised token is worse than an explicit rejection (P0-4).
  def self.identify(identifier)
    return nil if identifier.blank?

    sql_string = <<~SQL.squish
      (? IN (identifier, name, scheme, host)) OR
      (alias_hosts && ARRAY[?]::varchar[])
    SQL

    where(sql_string, identifier, Array(identifier)).first
  end
end
