# frozen_string_literal: true

require 'rails_helper'

# rubocop:disable Metrics/BlockLength
RSpec.describe 'API V1 portfolio status', type: :request do
  let!(:organization) do
    Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test.example.test')
  end
  let!(:assessment) do
    Assessment.unscoped.create!(
      tenant_id: organization.id, created_by: 1, name: 'Status', time_limit_min: 45, language: 'en'
    )
  end
  let(:headers) do
    token = JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end
  let(:session) do
    Session.unscoped.create!(
      tenant_id: organization.id, assessment: assessment, status: 'ended', end_reason: 'manual_candidate',
      ended_at: 1.hour.ago
    )
  end

  before { allow(PortfolioGeneratorWorker).to receive(:perform_async) }

  def portfolio_response
    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
    response.parsed_body
  end

  describe 'processing delay' do
    it 'is not delayed within the allowed wait' do
      session.create_portfolio!(generation_status: 'pending', generation_requested_at: 4.minutes.ago)

      expect(portfolio_response.dig('portfolio', 'processing_delayed')).to be(false)
    end

    it 'is delayed when a pending portfolio waited too long (Sidekiq down)' do
      session.create_portfolio!(generation_status: 'pending', generation_requested_at: 6.minutes.ago)

      expect(portfolio_response.dig('portfolio', 'processing_delayed')).to be(true)
    end

    it 'is delayed when generation itself takes too long' do
      session.create_portfolio!(generation_status: 'generating', generation_requested_at: 6.minutes.ago)

      body = portfolio_response

      expect(response).to have_http_status(:accepted)
      expect(body).to include('status' => 'generating', 'processing_delayed' => true)
    end

    it 'falls back to the end of the session for portfolios created before the timestamp existed' do
      session.create_portfolio!(generation_status: 'pending', generation_requested_at: nil)

      expect(portfolio_response.dig('portfolio', 'processing_delayed')).to be(true)
    end

    it 'restarts the wait when the assessor retries, even for an old session' do
      session.create_portfolio!(generation_status: 'failed', generation_error: 'Rate limited',
                                generation_requested_at: 1.hour.ago)

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(portfolio_response.dig('portfolio', 'processing_delayed')).to be(false)
    end

    it 'never reports a finished portfolio as delayed' do
      session.create_portfolio!(generation_status: 'complete', generation_requested_at: 1.hour.ago)

      expect(portfolio_response.dig('portfolio', 'processing_delayed')).to be(false)
    end
  end

  describe 'missing coverage' do
    before { session.create_portfolio!(generation_status: 'complete', generated_at: Time.current) }

    it 'flags a finished portfolio built without any coverage (sessions 14 and 15)' do
      session.coverage_maps.create!(skill_label: 'Testing', state: 'not_yet', probe_count: 0)

      expect(portfolio_response.dig('portfolio', 'coverage_missing')).to be(true)
    end

    it 'does not flag a portfolio with coverage' do
      session.coverage_maps.create!(skill_label: 'Testing', state: 'partial', probe_count: 2)

      expect(portfolio_response.dig('portfolio', 'coverage_missing')).to be(false)
    end

    it 'reaches the JSON export, because exported files travel without the page' do
      get "/api/v1/portfolios/#{session.portfolio.id}/export", params: { format: 'json' }, headers: headers.except('Content-Type')

      expect(JSON.parse(response.body).dig('portfolio', 'coverage_missing')).to be(true)
    end

    it 'reaches the session list' do
      get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers

      expect(response.parsed_body.dig('sessions', 0, 'coverage_missing')).to be(true)
    end
  end
end
# rubocop:enable Metrics/BlockLength
