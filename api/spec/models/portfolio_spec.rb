# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe '.for_tenant' do
    let(:tenant_a) { create(:organization) }
    let(:tenant_b) { create(:organization) }

    let!(:portfolio_a) do
      create(:portfolio, session: create(:session, tenant_id: tenant_a.id))
    end

    let!(:portfolio_b) do
      create(:portfolio, session: create(:session, tenant_id: tenant_b.id))
    end

    it 'only returns portfolios whose owning session belongs to the tenant' do
      expect(Portfolio.for_tenant(tenant_a.id)).to contain_exactly(portfolio_a)
      expect(Portfolio.for_tenant(tenant_b.id)).to contain_exactly(portfolio_b)
    end

    it 'finds nothing for a tenant with no portfolios' do
      empty_tenant = create(:organization)

      expect(Portfolio.for_tenant(empty_tenant.id)).to be_empty
    end
  end
end
