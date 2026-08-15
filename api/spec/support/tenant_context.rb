# frozen_string_literal: true

# TenantScoped#default_scope keys off RequestStore.store.key?(:tenant_id).
# When the key is absent the scope silently degrades to `all` — which means a
# spec that forgets to set tenant context passes for the wrong reason and would
# not catch a tenant-isolation regression. These helpers make the context
# explicit and always tear it down.
module TenantContext
  def with_tenant(organization)
    previous = RequestStore.store.dup
    Current.organization = organization
    Current.tenant_id    = organization.id
    yield
  ensure
    RequestStore.store.replace(previous)
  end

  def set_tenant(organization)
    Current.organization = organization
    Current.tenant_id    = organization.id
  end

  def clear_tenant
    RequestStore.clear!
  end
end

RSpec.configure do |config|
  config.include TenantContext

  # RequestStore is thread-local and unit specs run no middleware, so state
  # leaks between examples unless cleared explicitly.
  config.after { RequestStore.clear! }
end

RSpec.shared_context 'with tenant', :with_tenant do
  let!(:tenant)       { create(:organization, scheme: 'test-corp',  identifier: 'test-corp') }
  let!(:other_tenant) { create(:organization, scheme: 'other-corp', identifier: 'other-corp') }

  before { set_tenant(tenant) }
end
