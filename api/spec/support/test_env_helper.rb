# frozen_string_literal: true

# Test helpers shared across specs.
module TestEnvHelper
  # Scoped ENV override that always restores the previous value.
  def with_env(key, value)
    previous = ENV[key]
    ENV[key] = value
    yield
  ensure
    previous.nil? ? ENV.delete(key) : ENV[key] = previous
  end

  # Runs a block with Current.tenant_id set for tenant-scoped model work.
  # Uses Current.using (snapshot/restore) so nested with_tenant blocks do not
  # clobber the outer tenant context.
  def with_tenant(organization)
    Current.using(tenant_id: organization.id, organization: organization) do
      yield
    end
  end
end