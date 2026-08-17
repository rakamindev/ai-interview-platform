# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio skills API cross-tenant isolation', type: :request do
  let!(:tenant_a) { create(:organization, scheme: 'tenant-a') }
  let!(:tenant_b) { create(:organization, scheme: 'tenant-b') }

  let!(:portfolio_skill_a) do
    in_tenant(tenant_a) do
      assessment = create(:assessment)
      session = create(:session, assessment: assessment, status: 'ended')
      portfolio = create(:portfolio, session: session, generation_status: 'complete')
      create(:portfolio_skill, portfolio: portfolio)
    end
  end

  it 'returns 404 when a foreign tenant tries to override a portfolio skill' do
    headers = auth_header_for(scheme: 'tenant-b')

    post "/api/v1/portfolio_skills/#{portfolio_skill_a.id}/override",
         params: { override: { override_level: 1, assessor_notes: 'hacked' } },
         headers: headers

    expect(response).to have_http_status(:not_found)
    expect(AssessorOverride.count).to eq(0)
  end

  it 'allows the owning tenant to override its own portfolio skill' do
    headers = auth_header_for(scheme: 'tenant-a')

    post "/api/v1/portfolio_skills/#{portfolio_skill_a.id}/override",
         params: { override: { override_level: 4, assessor_notes: 'strong evidence' } },
         headers: headers

    expect(response).to have_http_status(:created)
    expect(AssessorOverride.last.override_level).to eq(4)
  end
end