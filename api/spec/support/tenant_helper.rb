# frozen_string_literal: true

# Organization is a read-only reference to a table owned by rakamin-api, with
# no migration/factory of its own — mirrors db/seeds.rb's raw-SQL insert so
# request specs can resolve a tenant via the JWT `scheme` claim.
module TenantHelper
  def create_test_organization(scheme: "test-corp-#{SecureRandom.hex(4)}")
    result = ActiveRecord::Base.connection.select_one(<<~SQL)
      INSERT INTO public.organizations
        (name, scheme, identifier, host, alias_hosts, config, created_at, updated_at)
      VALUES
        ('Test Corp', '#{scheme}', '#{scheme}', 'localhost', '{}', '{}', NOW(), NOW())
      RETURNING id, scheme;
    SQL

    Organization.find(result["id"])
  end

  def auth_headers_for(organization, role: "admin", user_id: 1)
    token = JsonWebToken.encode(user_id: user_id, role: role, scheme: organization.scheme)
    { "Authorization" => "Bearer #{token}" }
  end
end

RSpec.configure do |config|
  config.include TenantHelper, type: :request
  config.include TenantHelper, type: :model
end
