# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio endpoints', type: :request do
  let(:tenant) { create(:organization, name: 'Tenant', scheme: 'tenant-x', identifier: 'x') }
  let(:assessment) { create(:assessment, tenant_id: tenant.id, name: 'Assess') }

  let(:session) { create(:session, assessment:, tenant_id: tenant.id) }
  let(:portfolio) { create(:portfolio, session:) }
  let(:vacancy) { create(:vacancy, tenant_id: tenant.id, role_title: 'Role') }

  def auth_headers(role: 'admin')
    token = JsonWebToken.encode(user_id: 1, role:, scheme: tenant.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  before do
    portfolio
    vacancy
    allow(FitGapGeneratorWorker).to receive(:perform_async)
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
  end

  # ── show ───────────────────────────────────────────────────────────────────

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns the evaluation summary for a complete portfolio' do
      create(:portfolio_skill, portfolio:, ai_level: 3, ai_confidence: 'high', evidence: ['Quote'])

      get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers

      expect(response.status).to eq(200)
      body = JSON.parse(response.body)
      expect(body.dig('portfolio', 'evaluation', 'overall_status')).to eq('ready_for_review')
      expect(body.dig('portfolio', 'evaluation', 'coverage', 'percent')).to eq(100)
      expect(body.dig('portfolio', 'skills', 0, 'counter_evidence')).to eq([])
    end

    it 'returns 202 with status generating while the portfolio is generating' do
      portfolio.update!(generation_status: 'generating')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers

      expect(response.status).to eq(202)
      expect(JSON.parse(response.body)).to eq('status' => 'generating')
    end

    it 'returns the portfolio plus its error when generation failed' do
      portfolio.update!(generation_status: 'failed', generation_error: 'Gemini timeout')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers

      expect(response.status).to eq(200)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('Gemini timeout')
      expect(body.dig('portfolio', 'generation_status')).to eq('failed')
    end
  end

  # ── regenerate ─────────────────────────────────────────────────────────────

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    it 'rejects regeneration when the portfolio is not failed' do
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: auth_headers

      expect(response.status).to eq(422)
      expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
    end

    it 'queues regeneration and resets the error when the portfolio failed' do
      portfolio.update!(generation_status: 'failed', generation_error: 'boom')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: auth_headers

      expect(response.status).to eq(200)
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
      expect(portfolio.reload.generation_status).to eq('pending')
      expect(portfolio.reload.generation_error).to be_nil
    end
  end

  # ── export ─────────────────────────────────────────────────────────────────

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'rejects an unsupported format' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'csv' }, headers: auth_headers

      expect(response.status).to eq(422)
      expect(response.body).to include('Format must be')
    end

    it 'rejects export while the portfolio is not complete' do
      portfolio.update!(generation_status: 'pending')

      get "/api/v1/portfolios/#{portfolio.id}/export", headers: auth_headers

      expect(response.status).to eq(422)
      expect(response.body).to include('not ready for export')
    end

    it 'streams a JSON export for a complete portfolio' do
      create(:portfolio_skill, portfolio:, ai_level: 3, ai_confidence: 'high', evidence: ['Quote'])

      get "/api/v1/portfolios/#{portfolio.id}/export", headers: auth_headers

      expect(response.status).to eq(200)
      expect(response.headers['Content-Type']).to include('application/json')
      exported = JSON.parse(response.body)
      expect(exported.dig('portfolio', 'id')).to eq(portfolio.id)
      expect(exported.dig('portfolio', 'evaluation', 'overall_status')).to be_present
    end
  end

  # ── fitgap ─────────────────────────────────────────────────────────────────

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'returns the cached report when no newer override exists' do
      report = create(:fit_gap_report, portfolio:, vacancy:, generated_at: 1.hour.ago)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id },
           headers: auth_headers

      expect(response.status).to eq(200)
      expect(JSON.parse(response.body).dig('report', 'id')).to eq(report.id)
      expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
    end

    it 'queues regeneration when an override is newer than the cached report' do
      skill = create(:portfolio_skill, portfolio:, ai_level: 3)
      create(:fit_gap_report, portfolio:, vacancy:, generated_at: 1.hour.ago)
      create(:assessor_override, portfolio_skill: skill, override_level: 4)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id },
           headers: auth_headers

      expect(response.status).to eq(202)
      expect(JSON.parse(response.body)['status']).to eq('generating')
      expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
    end

    it 'requires a vacancy_id' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", headers: auth_headers

      expect(response.status).to eq(422)
      expect(response.body).to include('vacancy_id is required')
    end

    it 'returns 404 for an unknown vacancy' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: 999_999 },
           headers: auth_headers

      expect(response.status).to eq(404)
    end
  end

  # ── show_fitgap ────────────────────────────────────────────────────────────

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'returns the report when it exists' do
      report = create(:fit_gap_report, portfolio:, vacancy:)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth_headers

      expect(response.status).to eq(200)
      expect(JSON.parse(response.body).dig('report', 'id')).to eq(report.id)
    end

    it 'returns 404 when the report does not exist' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth_headers

      expect(response.status).to eq(404)
      expect(response.body).to include('Fit/gap report not found')
    end
  end
end
