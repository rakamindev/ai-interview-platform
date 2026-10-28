# frozen_string_literal: true

require 'rails_helper'

# AC5.3: the scope used by controllers must hide other tenants during a request, but background
# workers (which run without a tenant) must still find every record they are handed.
RSpec.describe 'Portfolio.in_current_tenant / PortfolioSkill.in_current_tenant' do
  let(:org_a) { create(:organization) }
  let(:org_b) { create(:organization) }
  let!(:skill_a) { create(:portfolio_skill, portfolio: create(:portfolio, organization: org_a)) }
  let!(:skill_b) { create(:portfolio_skill, portfolio: create(:portfolio, organization: org_b)) }

  it "returns only the current tenant's records inside a tenant context" do
    with_tenant(org_a) do
      expect(Portfolio.in_current_tenant).to contain_exactly(skill_a.portfolio)
      expect(PortfolioSkill.in_current_tenant).to contain_exactly(skill_a)
    end
  end

  it 'returns every record when no tenant is set (workers)' do
    expect(Portfolio.in_current_tenant).to contain_exactly(skill_a.portfolio, skill_b.portfolio)
    expect(PortfolioSkill.in_current_tenant).to contain_exactly(skill_a, skill_b)
  end

  it 'loads records that can still be updated (joins do not make them read-only)' do
    with_tenant(org_a) do
      skill = PortfolioSkill.in_current_tenant.find(skill_a.id)
      expect { skill.update!(competency_summary: 'Updated.') }.not_to raise_error
    end
  end
end
