# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Full Portfolio Regeneration Flow Integration', type: :request do
  let!(:org) { Organization.create!(id: 201, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:user) { User.create!(email: 'assessor_full@example.com', password: 'password123', role: 'admin') }
  let(:token) { JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: org.scheme }) }
  let(:headers) { { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' } }

  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Full Flow Assessment', created_by: user.id, time_limit_min: 30) }
  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 801, candidate_name: 'Candidate Full', status: 'ended') }
  let!(:portfolio) { session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'complete', generated_at: 1.hour.ago) }

  let!(:skill_1) do
    portfolio.portfolio_skills.create!(
      skill_label: 'Architecture',
      ai_level: 4,
      ai_confidence: 'high',
      competency_summary: 'Prior valid summary.',
      evidence: ['Prior quote']
    )
  end

  before do
    Sidekiq::Worker.clear_all
  end

  describe '1. Complete regeneration failure through real controller and worker flow' do
    it 'preserves complete status and existing valid skills when worker fails' do
      allow_any_instance_of(Gemini::HttpClient).to receive(:generate_content).and_raise(
        Gemini::HttpClient::ApiError, 'AI Provider 500'
      )

      # 1. POST regenerate
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
      expect(response).to have_http_status(:ok)
      expect(portfolio.reload.generation_status).to eq('generating')

      # 2. Worker executes
      expect {
        PortfolioGeneratorWorker.drain
      }.to raise_error(Gemini::HttpClient::ApiError)

      # 3. Portfolio state remains complete, preserving skills and setting safe warning
      portfolio.reload
      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to eq(1)
      expect(portfolio.portfolio_skills.first.competency_summary).to eq('Prior valid summary.')
      expect(portfolio.generation_error).to eq('Regeneration failed. Preserved previous results.')
    end
  end

  describe '3. GET /sessions/:id/portfolio for generating portfolio with prior valid skills' do
    it 'returns status generating and previous valid portfolio skills' do
      portfolio.update!(generation_status: 'generating')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
      expect(response).to have_http_status(:accepted)

      body = JSON.parse(response.body)
      expect(body['status']).to eq('generating')
      expect(body['portfolio']).to be_present
      expect(body['portfolio']['skills'].count).to eq(1)
      expect(body['portfolio']['skills'].first['skill_label']).to eq('Architecture')
    end
  end

  describe '4. Duplicate regeneration requests race condition' do
    it 'enqueues exactly 1 job and returns already-generating for second request' do
      # First request
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
      expect(response).to have_http_status(:ok)
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)

      # Immediate second request
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
      expect(response).to have_http_status(:accepted)
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)

      body = JSON.parse(response.body)
      expect(body['status']).to eq('generating')
      expect(body['message']).to eq('Portfolio generation is already in progress')
    end
  end

  describe '5. Enqueue failure handling' do
    it 'restores previous portfolio status and generation_error if Sidekiq enqueue fails' do
      portfolio.update!(generation_error: 'Previous warning note.')
      allow(PortfolioGeneratorWorker).to receive(:perform_async).and_raise(Redis::CannotConnectError, 'Redis offline')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:service_unavailable)
      expect(portfolio.reload.generation_status).to eq('complete')
      expect(portfolio.generation_error).to eq('Previous warning note.')
      expect(portfolio.portfolio_skills.count).to eq(1)
    end
  end
end
