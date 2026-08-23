# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let(:org_a) { create(:organization) }
  let(:org_b) { create(:organization) }

  let(:user_a) { create(:user, role: 'admin') }
  let(:headers_a) { authenticated_header(user_a, organization: org_a) }

  let(:assessment_a) { create(:assessment, tenant_id: org_a.id) }
  let(:session_a) { create(:session, :ended, assessment: assessment_a, tenant_id: org_a.id) }
  let(:portfolio_a) { create(:portfolio, session: session_a) }

  let(:assessment_b) { create(:assessment, tenant_id: org_b.id) }
  let(:session_b) { create(:session, :ended, assessment: assessment_b, tenant_id: org_b.id) }
  let(:portfolio_b) { create(:portfolio, session: session_b) }

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns portfolio for session belonging to the tenant' do
      create(:portfolio_skill, portfolio: portfolio_a, skill_label: 'React Core', ai_level: 3)

      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(json_response['portfolio']['id']).to eq(portfolio_a.id)
    end
  end

  describe 'Tenant Isolation (IDOR Prevention)' do
    it 'prevents User in Org A from accessing Portfolio in Org B' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end
end
