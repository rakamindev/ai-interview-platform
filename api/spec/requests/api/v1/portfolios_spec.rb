# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios API - Multi-Tenant Security (KEAMANAN-02)', type: :request do
  let!(:org_a) { Organization.create!(name: 'Company A', scheme: 'comp_a', identifier: 'comp_a', host: 'compa.test') }
  let!(:org_b) { Organization.create!(name: 'Company B', scheme: 'comp_b', identifier: 'comp_b', host: 'compb.test') }

  let!(:assessment_a) do
    Assessment.create!(
      tenant_id: org_a.id,
      created_by: 1,
      name: 'Frontend Test A',
      language: 'id',
      time_limit_min: 10
    )
  end

  let!(:session_a) do
    Session.create!(
      tenant_id: org_a.id,
      assessment: assessment_a,
      status: 'ended'
    )
  end

  let!(:portfolio_a) do
    Portfolio.create!(
      session: session_a,
      generation_status: 'complete'
    )
  end

  let!(:vacancy_a) do
    Vacancy.create!(
      tenant_id: org_a.id,
      created_by: 1,
      role_title: 'Frontend Engineer A'
    )
  end

  let!(:vacancy_b) do
    Vacancy.create!(
      tenant_id: org_b.id,
      created_by: 2,
      role_title: 'Frontend Engineer B'
    )
  end

  let!(:fit_gap_report_a) do
    FitGapReport.create!(
      portfolio: portfolio_a,
      vacancy_id: vacancy_a.id,
      skill_comparisons: [{ 'skill_id' => 'react', 'result' => 'match' }],
      culture_narrative: 'Strong alignment',
      overall_narrative: 'Good candidate',
      generated_at: Time.current
    )
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    context 'when assessor belongs to the same organization (Company A)' do
      it 'allows the export' do
        headers = auth_headers_for(org_a, role: 'assessor', user_id: 101)

        get "/api/v1/portfolios/#{portfolio_a.id}/export?format=json", headers: headers

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body['portfolio']['id']).to eq(portfolio_a.id)
      end
    end

    context 'when assessor belongs to a different organization (Company B - IDOR attempt)' do
      it 'rejects export with 404 Not Found' do
        headers = auth_headers_for(org_b, role: 'assessor', user_id: 202)

        get "/api/v1/portfolios/#{portfolio_a.id}/export?format=json", headers: headers

        # Security assertion: Cross-tenant portfolio data leak MUST be blocked!
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    context 'when assessor belongs to a different organization (Company B - IDOR attempt)' do
      it 'rejects fitgap generation with 404 Not Found' do
        headers = auth_headers_for(org_b, role: 'assessor', user_id: 202)
        payload = { vacancy_id: vacancy_b.id }.to_json

        post "/api/v1/portfolios/#{portfolio_a.id}/fitgap", params: payload, headers: headers

        expect(response).to have_http_status(:not_found)
        expect(response.body).to include('Portfolio not found')
      end
    end
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    context 'when assessor belongs to a different organization (Company B - IDOR attempt)' do
      it 'rejects fitgap regeneration with 404 Not Found' do
        headers = auth_headers_for(org_b, role: 'assessor', user_id: 202)
        payload = { vacancy_id: vacancy_b.id }.to_json

        post "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap", params: payload, headers: headers

        expect(response).to have_http_status(:not_found)
        expect(response.body).to include('Portfolio not found')
      end
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    context 'when assessor belongs to a different organization (Company B - IDOR attempt)' do
      it 'rejects viewing fitgap report with 404 Not Found' do
        headers = auth_headers_for(org_b, role: 'assessor', user_id: 202)

        get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: headers

        expect(response).to have_http_status(:not_found)
        expect(response.body).to include('Portfolio not found')
      end
    end
  end
end
