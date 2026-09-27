# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tenant Scoping & Unscoped Endpoints Characterization', type: :request do
  let!(:org_a) { create(:organization, scheme: 'org-a') }
  let!(:org_b) { create(:organization, scheme: 'org-b') }
  let!(:admin_a) { create(:user, :admin) }

  let!(:assessment_b) { create(:assessment, tenant_id: org_b.id, created_by: 999) }
  let!(:session_b) { create(:session, tenant_id: org_b.id, assessment: assessment_b) }
  let!(:portfolio_b) { create(:portfolio, session: session_b, generation_status: 'complete') }
  let!(:vacancy_a) { create(:vacancy, tenant_id: org_a.id, created_by: admin_a.id) }

  before do
    allow(FitGapGeneratorWorker).to receive(:perform_async)
  end

  describe 'Tenant Scoping on Portfolios (resolved GAP P0-3)' do
    it 'enforces tenant scoping and returns 404 Not Found for cross-tenant portfolio' do
      headers = authenticated_headers(admin_a, scheme: org_a.scheme)

      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_a.id }.to_json,
           headers: headers

      expect(response).to have_http_status(:not_found)
      expect(json_body[:errors].first[:message]).to eq('Portfolio not found')
    end
  end
end
