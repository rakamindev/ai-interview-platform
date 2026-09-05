# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session)      { create(:session, :ended, tenant_id: organization.id, assessment: assessment) }
  let(:portfolio)    { create(:portfolio, session: session, generation_status: 'complete') }

  let(:token)   { JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme) }
  let(:headers) { { 'Authorization' => "Bearer #{token}" } }

  def body
    JSON.parse(response.body)
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    before do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'React',
                               ai_confidence: 'low', covered_by: 'window_timeout')
    end

    it 'returns the promotion provenance alongside the confidence' do
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      skill = body.dig('portfolio', 'skills').first
      expect(skill).to include('ai_confidence' => 'low', 'covered_by' => 'window_timeout')
    end

    # 403, not 401: require_tenant! runs before the auth filter.
    it 'rejects a request with no token' do
      get "/api/v1/sessions/#{session.id}/portfolio"

      expect(response).to have_http_status(:forbidden)
    end

    it 'does not serve a session belonging to another tenant' do
      other_org = create(:organization)
      other_token = JsonWebToken.encode(user_id: 2, role: 'admin', scheme: other_org.scheme)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: { 'Authorization' => "Bearer #{other_token}" }

      expect(response).to have_http_status(:not_found)
    end
  end
end
