# frozen_string_literal: true

# Shared behavior for models that inherit tenant_id from a parent record
# instead of Current.tenant_id (they're created by background jobs, which
# have no request context). Include with `record` and `expected_tenant_id`
# defined via `let`.
RSpec.shared_examples "a tenant scoped child model" do
  after { Current.clear }

  it "inherits tenant_id from its parent on create" do
    expect(record.tenant_id).to eq(expected_tenant_id)
  end

  it "is excluded from queries scoped to a different tenant" do
    Current.tenant_id = expected_tenant_id + 1
    expect(described_class.all).not_to include(record)
  end

  it "is included in queries scoped to its own tenant" do
    Current.tenant_id = expected_tenant_id
    expect(described_class.all).to include(record)
  end

  it "is visible when no tenant is set (background job context)" do
    expect(described_class.all).to include(record)
  end
end
