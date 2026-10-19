# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe '.find_for_current_tenant!' do
    let!(:org_a) { ensure_organization(scheme: 'tenant-a-spec', name: 'Tenant A', identifier: 'tenant-a-spec', host: 'a.local') }
    let!(:org_b) { ensure_organization(scheme: 'tenant-b-spec', name: 'Tenant B', identifier: 'tenant-b-spec', host: 'b.local') }

    let(:assessment_a) { create_assessment_for(org_a.id) }
    let(:session_a)    { create_session_for(assessment_a, org_a.id) }
    let!(:portfolio_a) { create_complete_portfolio_for(session_a) }

    let(:assessment_b) { create_assessment_for(org_b.id) }
    let(:session_b)    { create_session_for(assessment_b, org_b.id) }
    let!(:portfolio_b) { create_complete_portfolio_for(session_b) }

    it 'returns portfolio belonging to current tenant' do
      Current.using(organization: org_a, tenant_id: org_a.id) do
        expect(described_class.find_for_current_tenant!(portfolio_a.id)).to eq(portfolio_a)
      end
    end

    it 'raises when portfolio belongs to another tenant' do
      Current.using(organization: org_a, tenant_id: org_a.id) do
        expect do
          described_class.find_for_current_tenant!(portfolio_b.id)
        end.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end
end
