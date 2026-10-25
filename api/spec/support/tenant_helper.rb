# frozen_string_literal: true

module TenantHelper
  def set_current_tenant(organization = nil)
    org = organization || create(:organization)
    RequestStore.store[:organization] = org
    Current.organization = org
    Current.tenant_id = org.id
    org
  end
end
