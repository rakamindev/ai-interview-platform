# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio tenant authorization', type: :request do
  let!(:org_a) { ensure_organization(scheme: 'authz-tenant-a', name: 'Authz A', identifier: 'authz-tenant-a', host: 'authz-a.local') }
  let!(:org_b) { ensure_organization(scheme: 'authz-tenant-b', name: 'Authz B', identifier: 'authz-tenant-b', host: 'authz-b.local') }
  let(:user) { ensure_admin_user }

  let(:assessment_a) { create_assessment_for(org_a.id, user_id: user.id) }
  let(:session_a)    { create_session_for(assessment_a, org_a.id) }
  let!(:portfolio_a) { create_complete_portfolio_for(session_a) }

  let(:assessment_b) { create_assessment_for(org_b.id, user_id: user.id) }
  let(:session_b)    { create_session_for(assessment_b, org_b.id) }
  let!(:portfolio_b) { create_complete_portfolio_for(session_b) }

  let(:headers_a) { auth_headers(org_a, user: user) }

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'allows export for portfolio in the JWT tenant' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export",
          params:  { format: 'json' },
          headers: headers_a

      expect(response).to have_http_status(:ok)
    end

    it 'returns 404 for portfolio owned by another tenant' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export",
          params:  { format: 'json' },
          headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(response.parsed_body.dig('errors', 0, 'message')).to match(/Portfolio not found/i)
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    let!(:vacancy_b) { create_vacancy_for(org_b.id, user_id: user.id) }

    it 'returns 404 when portfolio is cross-tenant' do
      post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
           params:  { fitgap: { vacancy_id: vacancy_b.id } },
           headers: headers_a,
           as:      :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    let(:skill_b) do
      portfolio_b.portfolio_skills.create!(
        skill_label:        'Communication',
        ai_level:           3,
        ai_confidence:      'medium',
        evidence:           ['quote'],
        competency_summary: 'Summary'
      )
    end

    it 'returns 404 for skill on another tenant portfolio' do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           params:  { override: { override_level: 4, assessor_notes: 'Adjusted' } },
           headers: headers_a,
           as:      :json

      expect(response).to have_http_status(:not_found)
    end
  end
end
