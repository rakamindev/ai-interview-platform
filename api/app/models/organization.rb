# frozen_string_literal: true

# Read-only reference to the existing rakamin-api organizations table.
# Lives in the PostgreSQL public schema (excluded from Apartment in rakamin-api).
# We connect to the same DB so this table is directly accessible.
#
# Only includes the fields we need for tenant resolution.
class Organization < ApplicationRecord
  self.table_name = 'public.organizations'

  # Mirrors rakamin-api Organisation.identify exactly.
  # Accepts identifier, name, scheme, or host.
  def self.identify(identifier)
    return default_organization if identifier.blank?

    sql_string = <<~SQL.squish
      (? IN (identifier, name, scheme, host)) OR
      (alias_hosts && ARRAY[?]::varchar[])
    SQL

    where(sql_string, identifier, Array(identifier)).first ||
      default_organization
  end

  def self.default_organization
    where(id: 0).first
  end

  # Convenience: is this the system default org?
  def default?
    id.zero?
  end
end
