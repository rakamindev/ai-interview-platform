# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios API' do
  let(:headers) { auth_headers_for(user_id: 2, role: 'admin', scheme: 'test-corp') }

  let(:assessment) { create(:assessment, name: 'Backend Engineer') }
  let(:session)    { create(:session, assessment: assessment, status: 'ended', started_at: 10.minutes.ago) }

  def portfolio_jobs
    Sidekiq::Job.jobs.select { |j| j['class'] == 'PortfolioGeneratorWorker' }.flat_map { |j| j['args'] }
  end

  before do
    create_test_organization!
    establish_test_tenant!
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns generating (202) for a pending portfolio' do
      create(:portfolio, session: session, generation_status: 'pending')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      expect(response.parsed_body['status']).to eq('generating')
    end

    it 'returns generating (202) for a generating portfolio' do
      create(:portfolio, session: session, generation_status: 'generating',
                         generation_attempted_at: Time.current)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      expect(response.parsed_body['status']).to eq('generating')
    end

    it 'self-heals an ended session with no portfolio (creates + enqueues once)' do
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      expect(session.reload.portfolio).to be_present
      expect(portfolio_jobs).to eq([session.id])
    end

    it 'self-heals a stuck pending portfolio older than the recovery TTL' do
      portfolio = create(:portfolio, session: session, generation_status: 'pending')
      portfolio.update!(generation_attempted_at: nil, created_at: 30.minutes.ago)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      expect(portfolio.reload.generation_attempted_at).not_to be_nil
      expect(portfolio_jobs).to eq([session.id])
    end

    it 'does not enqueue a fresh (non-stuck) pending portfolio' do
      create(:portfolio, session: session, generation_status: 'pending',
                         generation_attempted_at: 1.minute.ago)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      expect(portfolio_jobs).to be_empty
    end

    it 'returns the complete portfolio payload with skills' do
      portfolio = create(:portfolio, session: session, generation_status: 'complete',
                                     generated_at: Time.current)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby', ai_level: 3,
                               ai_confidence: 'high')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      body = response.parsed_body['portfolio']
      expect(body['generation_status']).to eq('complete')
      expect(body['skills'].map { |s| s['skill_label'] }).to include('Ruby')
    end

    it 'returns the failed portfolio with its error and a 200' do
      create(:portfolio, session: session, generation_status: 'failed',
                         generation_error: 'Gemini model returned 500')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['portfolio']['generation_status']).to eq('failed')
      expect(response.parsed_body['error']).to match(/500/)
    end

    it 'rejects requests without a tenant (401/404 tenant error)' do
      create(:portfolio, session: session, generation_status: 'complete',
                         generated_at: Time.current)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers.except('Authorization')

      expect(response.status).to be_in([401, 404, 422])
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    it 'queues regeneration for a pending portfolio' do
      create(:portfolio, session: session, generation_status: 'pending')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:ok)
      expect(portfolio_jobs).to eq([session.id])
      expect(session.portfolio.reload.generation_status).to eq('pending')
    end

    it 'queues regeneration for a generating portfolio' do
      create(:portfolio, session: session, generation_status: 'generating',
                         generation_attempted_at: Time.current)

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:ok)
      expect(portfolio_jobs).to eq([session.id])
    end

    it 'queues regeneration for a failed portfolio and clears the error' do
      create(:portfolio, session: session, generation_status: 'failed',
                         generation_error: 'boom')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:ok)
      expect(session.portfolio.reload.generation_status).to eq('pending')
      expect(session.portfolio.reload.generation_error).to be_nil
      expect(portfolio_jobs).to eq([session.id])
    end

    it 'rejects regeneration when the portfolio is already complete' do
      create(:portfolio, session: session, generation_status: 'complete',
                         generated_at: Time.current)

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(portfolio_jobs).to be_empty
    end

    it 'returns 404 when the session has no portfolio' do
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end