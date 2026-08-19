# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe 'tenant scoping' do
    let!(:tenant_a) { create(:organization) }
    let!(:tenant_b) { create(:organization) }

    let!(:portfolio_a) do
      in_tenant(tenant_a) { create(:portfolio) }
    end
    let!(:portfolio_b) do
      in_tenant(tenant_b) { create(:portfolio) }
    end

    it 'only returns portfolios belonging to the current tenant' do
      with_tenant(tenant_a) do
        expect(Portfolio.all).to contain_exactly(portfolio_a)
      end

      with_tenant(tenant_b) do
        expect(Portfolio.all).to contain_exactly(portfolio_b)
      end
    end

    it 'raises RecordNotFound when a foreign tenant attempts to find by id' do
      with_tenant(tenant_b) do
        expect { Portfolio.find(portfolio_a.id) }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    it 'returns all records outside a request context (background workers)' do
      # No RequestStore tenant context — Sidekiq workers must still find the record.
      expect(Portfolio.find(portfolio_a.id)).to eq(portfolio_a)
    end
  end

  describe 'generation status predicates' do
    let!(:org) { create(:organization) }

    it 'exposes complete?/failed?/generating?' do
      with_tenant(org) do
        pending_p = create(:portfolio, generation_status: 'pending')
        complete_p = create(:portfolio, generation_status: 'complete')
        failed_p = create(:portfolio, generation_status: 'failed')

        expect(pending_p).not_to be_complete
        expect(complete_p).to be_complete
        expect(failed_p).to be_failed
      end
    end
  end
end