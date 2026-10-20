require_relative "../rails_helper"

RSpec.describe TenantScoped do
  after { Current.clear }

  it "does not expose tenant records when tenant context is missing" do
    Current.clear

    expect(Assessment.all.to_sql).to include('"assessments"."tenant_id" IS NULL')
  end

  it "filters records by the current tenant" do
    sql = Current.using(tenant_id: 42) { Assessment.all.to_sql }

    expect(sql).to include('"assessments"."tenant_id" = 42')
  end
end