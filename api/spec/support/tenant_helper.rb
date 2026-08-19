# TenantScoped models (Assessment, Vacancy, Session, Candidate, ...) resolve tenant_id
# from Current.tenant_id, which is normally set per-request by TenantResolverMiddleware.
# In specs we set it directly so factories for those models don't need an explicit
# tenant_id every time.
module TenantHelper
  def set_current_tenant(organization = create(:organization))
    Current.tenant_id = organization.id
    Current.organization = organization
    organization
  end
end

RSpec.configure do |config|
  config.include TenantHelper
  config.after { Current.clear }
end
