# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe '.for_tenant' do
    let!(:org_a) { create(:organization, scheme: 'org-a') }
    let!(:org_b) { create(:organization, scheme: 'org-b') }

    let!(:assessment_a) { create(:assessment, tenant_id: org_a.id, created_by: 1) }
    let!(:session_a) { create(:session, tenant_id: org_a.id, assessment: assessment_a) }
    let!(:portfolio_a) { create(:portfolio, session: session_a) }

    let!(:assessment_b) { create(:assessment, tenant_id: org_b.id, created_by: 2) }
    let!(:session_b) { create(:session, tenant_id: org_b.id, assessment: assessment_b) }
    let!(:portfolio_b) { create(:portfolio, session: session_b) }

    it 'returns only portfolios belonging to sessions of the specified tenant' do
      expect(Portfolio.for_tenant(org_a.id)).to contain_exactly(portfolio_a)
      expect(Portfolio.for_tenant(org_b.id)).to contain_exactly(portfolio_b)
    end
  end
end
