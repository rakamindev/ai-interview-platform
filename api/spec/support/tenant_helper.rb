# frozen_string_literal: true

# TenantScoped reads RequestStore; a spec that forgets to set the tenant
# silently gets default_scope { all } and passes while proving nothing.
# `with_tenant` makes the tenant explicit.
module TenantHelper
  def with_tenant(organization, &block)
    Current.organization = organization
    block.call
  ensure
    Current.organization = nil
  end
end
