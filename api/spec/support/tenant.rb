# TenantScoped models (Assessment, Session, Vacancy, ...) default-scope every
# query to Current.tenant_id. Give every example a real Organization row and
# point Current at it, mirroring what TenantResolverMiddleware does per-request.
RSpec.configure do |config|
  config.before(:each) do
    organization = FactoryBot.create(:organization)
    Current.organization = organization
    Current.tenant_id = organization.id
  end

  config.after(:each) do
    Current.clear
  end
end
