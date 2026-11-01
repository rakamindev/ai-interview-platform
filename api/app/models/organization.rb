# frozen_string_literal: true

# Read-only reference to the existing rakamin-api organizations table.
# Lives in the PostgreSQL public schema (excluded from Apartment in rakamin-api).
# We connect to the same DB so this table is directly accessible.
#
# Only includes the fields we need for tenant resolution.
class Organization < ApplicationRecord
  self.table_name = 'organizations'

  # Accepts identifier, name, scheme, or host.
  def self.identify(identifier)
    return default_organization if identifier.blank?

    target = identifier.to_s.strip
    where('identifier = :val OR name = :val OR scheme = :val OR host = :val', val: target).first ||
      where('alias_hosts @> ARRAY[?]::varchar[]', target).first ||
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
