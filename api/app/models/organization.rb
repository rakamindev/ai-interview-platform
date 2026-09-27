# frozen_string_literal: true

# Read-only reference to the existing rakamin-api organizations table.
# Lives in the PostgreSQL public schema (excluded from Apartment in rakamin-api).
# We connect to the same DB so this table is directly accessible.
#
# Only includes the fields we need for tenant resolution.
class Organization < ApplicationRecord
  self.table_name = 'organizations'

  has_many :users, dependent: :nullify

  before_validation :normalize_and_default_attributes

  validates :name, presence: true
  validates :scheme, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: /\A[a-z0-9\-_]+\z/, message: 'must contain only lowercase letters, numbers, hyphens, or underscores' }
  validates :identifier, presence: true,
                        uniqueness: { case_sensitive: false }
  validates :host, presence: true

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

  private

  def normalize_and_default_attributes
    self.scheme = scheme.to_s.strip.downcase if scheme.present?
    self.identifier = identifier.presence || scheme
    self.identifier = identifier.to_s.strip.downcase if identifier.present?
    self.host = host.presence || "#{identifier}.localhost" if identifier.present?
    self.alias_hosts ||= []
    self.config ||= {}
  end
end
