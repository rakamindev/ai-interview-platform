# frozen_string_literal: true

require 'ostruct'

# Binds Current.organization / Current.tenant_id for the duration of an example.
#
# TenantScoped installs a default_scope that reads Current.tenant_id and a
# before_validation that assigns it. Current raises when the key is missing,
# so without this every model spec would blow up before reaching its assertion.
#
# `public.organizations` is owned by rakamin-api, not by this service's
# migrations — db/seeds.rb creates it with raw SQL. The test database therefore
# needs the same treatment before any tenant-scoped record can exist.
module TenantContext
  TEST_SCHEME = 'rspec-corp'

  module_function

  def ensure_organizations_table!
    ActiveRecord::Base.connection.execute(<<~SQL)
      CREATE TABLE IF NOT EXISTS public.organizations (
        id          BIGSERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        scheme      VARCHAR(255) NOT NULL,
        identifier  VARCHAR(255) NOT NULL,
        host        VARCHAR(255) NOT NULL,
        alias_hosts VARCHAR[] NOT NULL DEFAULT '{}',
        config      JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    SQL
  end

  # Transactional fixtures roll the example back, so the organization row is
  # created once outside the example and reused.
  def organization
    @organization ||= begin
      existing = Organization.find_by(scheme: TEST_SCHEME)
      existing || Organization.create!(
        name:       'RSpec Corp',
        scheme:     TEST_SCHEME,
        identifier: TEST_SCHEME,
        host:       'rspec.test'
      )
    end
  end

  def with_tenant(org = organization, &block)
    Current.using(organization: org, tenant_id: org.id, user: OpenStruct.new(id: 1, role: 'admin'), &block)
  end

  def current_tenant_id
    Current.tenant_id
  end
end
