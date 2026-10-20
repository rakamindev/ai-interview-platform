# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfoliosController', type: :request do
  let(:org_a) { create_organization(name: 'Tenant Alpha') }
  let(:user_a) { create_user(role: 'admin') }
  let(:headers_a) { auth_headers_for(user: user_a, organization: org_a) }

  let(:org_b) { create_organization(name: 'Tenant Beta') }
  let(:user_b) { create_user(role: 'admin') }
  let(:headers_b) { auth_headers_for(user: user_b, organization: org_b) }

  let(:assessment_a) do
    Assessment.create!(
      tenant_id: org_a.id,
      created_by: user_a.id,
      name: 'Alpha Assessment',
      time_limit_min: 30
    )
  end
  let(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment_id: assessment_a.id,
      invite_token: SecureRandom.hex(16),
      status: 'ended'
    )
  end
  let(:portfolio_a) do
    Portfolio.create!(
      session_id: session_a.id,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end
  let(:vacancy_a) do
    Vacancy.create!(
      tenant_id: org_a.id,
      created_by: user_a.id,
      role_title: 'Alpha Role'
    )
  end

  let(:assessment_b) do
    Assessment.create!(
      tenant_id: org_b.id,
      created_by: user_b.id,
      name: 'Beta Assessment',
      time_limit_min: 30
    )
  end
  let(:session_b) do
    Session.create!(
      tenant_id: org_b.id,
      assessment_id: assessment_b.id,
      invite_token: SecureRandom.hex(16),
      status: 'ended'
    )
  end
  let(:portfolio_b) do
    Portfolio.create!(
      session_id: session_b.id,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end
  let(:vacancy_b) do
    Vacancy.create!(
      tenant_id: org_b.id,
      created_by: user_b.id,
      role_title: 'Beta Role'
    )
  end

  describe 'AC-S1: Multi-tenant scoping on portfolios' do
    it 'returns 404 when Tenant B tries to GET Tenant A session portfolio' do
      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: headers_b
      expect(response).to have_http_status(:not_found)
    end

    it 'returns 404 when Tenant B tries to POST regenerate on Tenant A session' do
      post "/api/v1/sessions/#{session_a.id}/portfolio/regenerate", headers: headers_b
      expect(response).to have_http_status(:not_found)
    end

    it 'returns 404 when Tenant B tries to POST fitgap on Tenant A portfolio' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { vacancy_id: vacancy_b.id },
           headers: headers_b
      expect(response).to have_http_status(:not_found)
    end

    it 'returns 404 when Tenant A tries to use Tenant B vacancy in fitgap' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { vacancy_id: vacancy_b.id },
           headers: headers_a
      expect(response).to have_http_status(:not_found)
    end

    it 'returns 404 when Tenant B tries to export Tenant A portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export", headers: headers_b
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'AC-S2: Input validation on export and fitgap' do
    it 'returns 422 when export format is not pdf or json' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=csv", headers: headers_a
      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      errMsg = json.dig('errors', 0, 'message') || json['error']
      expect(errMsg).to include('pdf')
    end

    it 'returns 422 when vacancy_id is not an integer' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { vacancy_id: 'non-numeric' },
           headers: headers_a
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'AC-G5: POST regenerate returns 409 conflict when already generating' do
    it 'returns 409 Conflict if portfolio is in generating state' do
      portfolio_a.update!(generation_status: 'generating')

      post "/api/v1/sessions/#{session_a.id}/portfolio/regenerate", headers: headers_a
      expect(response).to have_http_status(:conflict)
    end
  end
end
