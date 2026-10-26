# frozen_string_literal: true

require 'rails_helper'
require 'sidekiq/testing'

# POST /api/v1/sessions/:token/audio_complete is the candidate-facing endpoint
# (no JWT, invite token only) that finishes a session once the interview audio
# has drained. Finishing a session creates a portfolio and enqueues AI scoring,
# so it must only ever happen for a session that really ran.
RSpec.describe 'POST /api/v1/sessions/:token/audio_complete', type: :request do
  def complete!(interview)
    post "/api/v1/sessions/#{interview.invite_token}/audio_complete"
  end

  before do
    Sidekiq::Testing.fake!
    PortfolioGeneratorWorker.clear
    Rack::Attack.enabled = false
    # EndHandler publishes a status update to Redis; keep this spec independent of a running Redis.
    allow(::Redis).to receive(:new).and_return(double('redis', publish: 1, close: nil))
  end

  after { Rack::Attack.enabled = true }

  context 'when the session never started (pending)' do
    it 'refuses to end it and leaves no trace of a finished interview' do
      interview = FactoryBot.create(:session)

      complete!(interview)

      expect(response).to have_http_status(:conflict)
      interview.reload
      expect(interview.status).to eq('pending')
      expect(interview.end_reason).to be_nil
      expect(interview.portfolio).to be_nil
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end
  end

  context 'when the session is active' do
    it 'ends it, creates the portfolio and enqueues scoring once' do
      interview = FactoryBot.create(:session, :active)

      complete!(interview)

      expect(response).to have_http_status(:ok)
      interview.reload
      expect(interview.status).to eq('ended')
      expect(interview.end_reason).to eq('all_covered')
      expect(interview.ended_at).to be_present
      expect(interview.portfolio.generation_status).to eq('pending')
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
    end

    it 'is idempotent when the candidate browser retries the call' do
      interview = FactoryBot.create(:session, :active)

      complete!(interview)
      complete!(interview)

      expect(response).to have_http_status(:ok)
      expect(Portfolio.where(session_id: interview.id).count).to eq(1)
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
    end
  end

  context 'when the invite token is unknown' do
    it 'responds 404' do
      post '/api/v1/sessions/does-not-exist/audio_complete'

      expect(response).to have_http_status(:not_found)
    end
  end
end
