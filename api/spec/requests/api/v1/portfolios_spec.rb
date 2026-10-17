# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:admin_token) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme }) }
  let(:headers) { { 'Authorization' => "Bearer #{admin_token}" } }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session_record) { create(:session, assessment: assessment, tenant_id: org.id, status: 'ended') }
  let!(:portfolio) { create(:portfolio, session: session_record, generation_status: 'complete') }
  let(:vacancy) { create(:vacancy, tenant_id: org.id) }

  before do
    org
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns portfolio details when complete' do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Architecture Design', ai_level: 4)

      get "/api/v1/sessions/#{session_record.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['portfolio']['id']).to eq(portfolio.id)
      expect(json['portfolio']['generation_status']).to eq('complete')
      expect(json['portfolio']['skills'].first['skill_label']).to eq('Architecture Design')
    end

    it 'returns 202 accepted when portfolio is generating' do
      portfolio.update!(generation_status: 'generating')

      get "/api/v1/sessions/#{session_record.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      json = JSON.parse(response.body)
      expect(json['status']).to eq('generating')
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    it 'allows regeneration when portfolio status is failed' do
      portfolio.update!(generation_status: 'failed', generation_error: 'Gemini rate limit')

      expect(PortfolioGeneratorWorker).to receive(:perform_async).with(session_record.id)

      post "/api/v1/sessions/#{session_record.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:ok)
      expect(portfolio.reload.generation_status).to eq('pending')
      expect(portfolio.generation_error).to be_nil
    end

    it 'rejects regeneration when portfolio is already complete' do
      post "/api/v1/sessions/#{session_record.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['errors'].first['message']).to include("only be regenerated when status is 'failed'")
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'returns existing report if already generated' do
      report = create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id },
           headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['report']['id']).to eq(report.id)
    end

    it 'enqueues generator worker if report does not exist' do
      expect(FitGapGeneratorWorker).to receive(:perform_async).with(portfolio.id, vacancy.id)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id },
           headers: headers

      expect(response).to have_http_status(:accepted)
      json = JSON.parse(response.body)
      expect(json['status']).to eq('generating')
    end
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    it 'safely enqueues regeneration without dropping existing report prematurely' do
      report = create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy)
      expect(FitGapGeneratorWorker).to receive(:perform_async).with(portfolio.id, vacancy.id)

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy.id },
           headers: headers

      expect(response).to have_http_status(:accepted)
      # Existing report must still exist in DB until worker finishes
      expect(FitGapReport.find_by(id: report.id)).not_to be_nil
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'exports portfolio in json format' do
      get "/api/v1/portfolios/#{portfolio.id}/export",
          params: { format: 'json' },
          headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include('application/json')
      json = JSON.parse(response.body)
      expect(json['portfolio']['id']).to eq(portfolio.id)
    end

    it 'rejects export if format is unsupported' do
      get "/api/v1/portfolios/#{portfolio.id}/export",
          params: { format: 'xml' },
          headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
