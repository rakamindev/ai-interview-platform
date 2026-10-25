# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let!(:org) { create(:organization, scheme: 'demo') }
  let(:headers) { auth_headers(user_id: 1, role: 'assessor', scheme: 'demo') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session_record) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: session_record) }
  let!(:skill) { create(:portfolio_skill, portfolio: portfolio, ai_level: 3) }
  let(:vacancy) { create(:vacancy, tenant_id: org.id) }

  describe 'GET /api/v1/sessions/:id/portfolio' do
    context 'when unauthorized' do
      it 'returns 401 Unauthorized without auth headers' do
        get "/api/v1/sessions/#{session_record.id}/portfolio", headers: { 'X-Tenant-Scheme' => 'demo' }
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when authorized' do
      it 'returns the portfolio JSON when complete' do
        get "/api/v1/sessions/#{session_record.id}/portfolio", headers: headers
        expect(response).to have_http_status(:ok)

        json = JSON.parse(response.body)
        expect(json['portfolio']['id']).to eq(portfolio.id)
        expect(json['portfolio']['skills'].first['ai_level']).to eq(3)
      end

      it 'returns 202 Accepted when generating' do
        portfolio.update!(generation_status: 'generating')
        get "/api/v1/sessions/#{session_record.id}/portfolio", headers: headers
        expect(response).to have_http_status(:accepted)
      end
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    it 'returns 422 if portfolio is not failed' do
      post "/api/v1/sessions/#{session_record.id}/portfolio/regenerate", headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'queues regeneration when portfolio has failed status' do
      portfolio.update!(generation_status: 'failed', generation_error: 'LLM timeout')
      expect(PortfolioGeneratorWorker).to receive(:perform_async).with(session_record.id)

      post "/api/v1/sessions/#{session_record.id}/portfolio/regenerate", headers: headers
      expect(response).to have_http_status(:ok)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    let!(:report) do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy)
    end

    it 'returns the fit/gap report' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json['report']['id']).to eq(report.id)
      expect(json['report']['skill_comparisons']).to be_an(Array)
    end

    context 'multi-tenant isolation' do
      let!(:other_org) { create(:organization, scheme: 'other-tenant') }
      let!(:other_vacancy) { create(:vacancy, tenant_id: other_org.id) }
      let!(:other_assessment) { create(:assessment, tenant_id: other_org.id) }
      let!(:other_session) { create(:session, assessment: other_assessment, tenant_id: other_org.id) }
      let!(:other_portfolio) { create(:portfolio, session: other_session) }

      it 'returns 404 Not Found when attempting to access a vacancy belonging to another tenant' do
        get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{other_vacancy.id}", headers: headers
        expect(response).to have_http_status(:not_found)

        post "/api/v1/portfolios/#{portfolio.id}/fitgap",
             params: { vacancy_id: other_vacancy.id }.to_json,
             headers: headers
        expect(response).to have_http_status(:not_found)

        post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
             params: { vacancy_id: other_vacancy.id }.to_json,
             headers: headers
        expect(response).to have_http_status(:not_found)
      end

      it 'returns 404 Not Found when attempting to access a portfolio belonging to another tenant' do
        get "/api/v1/portfolios/#{other_portfolio.id}/fitgap/#{vacancy.id}", headers: headers
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    let!(:report) { create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy) }

    it 'exports JSON report' do
      get "/api/v1/portfolios/#{portfolio.id}/export?format=json&vacancy_id=#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:ok)
      expect(response.headers['Content-Type']).to include('application/json')
    end

    it 'exports PDF report' do
      get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf&vacancy_id=#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:ok)
      expect(response.headers['Content-Type']).to include('application/pdf')
    end
  end
end
