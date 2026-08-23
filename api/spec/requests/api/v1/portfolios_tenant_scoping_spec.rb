# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios Tenant Scoping', type: :request do
  let!(:org1) { Organization.find_or_create_by!(id: 1) { |o| o.identifier = 'org1'; o.name = 'Org 1'; o.scheme = 'org1'; o.host = 'localhost' } }
  let!(:org2) { Organization.find_or_create_by!(id: 2) { |o| o.identifier = 'org2'; o.name = 'Org 2'; o.scheme = 'org2'; o.host = 'otherhost' } }

  let(:token1) { JsonWebToken.encode(user_id: 1, role: 'admin', scheme: 'org1') }
  let(:headers1) { { 'Authorization' => "Bearer #{token1}", 'X-Tenant-Scheme' => 'org1' } }

  let(:assessment1) { create(:assessment, tenant_id: 1) }
  let(:session1) { create(:session, assessment: assessment1, tenant_id: 1) }
  let(:portfolio1) { create(:portfolio, session: session1, generation_status: 'complete') }

  let(:assessment2) { create(:assessment, tenant_id: 2) }
  let(:session2) { create(:session, assessment: assessment2, tenant_id: 2) }
  let(:portfolio2) { create(:portfolio, session: session2, generation_status: 'complete') }

  let(:vacancy2) { create(:vacancy, tenant_id: 2) }

  describe 'Cross-tenant access restriction' do
    it 'returns 404 when Org1 assessor requests Org2 portfolio export' do
      get "/api/v1/portfolios/#{portfolio2.id}/export", headers: headers1
      expect(response).to have_http_status(:not_found)
    end

    it 'returns 404 when Org1 assessor requests fitgap with Org2 vacancy' do
      post "/api/v1/portfolios/#{portfolio1.id}/fitgap", params: { vacancy_id: vacancy2.id }, headers: headers1
      expect(response).to have_http_status(:not_found)
    end
  end
end
