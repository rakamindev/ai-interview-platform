# frozen_string_literal: true

# Every worker runs with an empty RequestStore (see TenantScoped's default_scope,
# which degrades to unscoped when RequestStore has no :tenant_id key). Clearing
# Current before AND after each example keeps specs honest about that — a spec
# that sets Current.tenant_id without cleaning up would otherwise silently scope
# every later example's queries.
RSpec.configure do |config|
  config.before do
    Current.clear
  end

  config.after do
    Current.clear
  end
end

# Wraps Current.using for readability in specs:
#
#   with_tenant(org) { expect(Assessment.count).to eq(1) }
#
def with_tenant(organization, &block)
  Current.using(organization: organization, tenant_id: organization.id, &block)
end
