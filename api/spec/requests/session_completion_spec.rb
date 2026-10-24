# frozen_string_literal: true

RSpec.describe 'Candidate audio completion', type: :request do
  let!(:organization) do
    Organization.create!(name: 'Completion Org', scheme: 'completion-org',
                         identifier: 'completion-org', host: 'completion.example.test')
  end
  let!(:assessment) do
    Assessment.create!(tenant_id: organization.id, created_by: 1,
                       name: 'Completion test', time_limit_min: 30)
  end
  let!(:session) { Session.create!(tenant_id: organization.id, assessment: assessment) }

  def complete
    post "/api/v1/sessions/#{session.invite_token}/audio_complete"
  end

  it 'does not end a pending session with only an invite token' do
    complete

    expect(response).to have_http_status(:conflict)
    expect(session.reload).to be_pending
  end

  it 'does not end an active session before the server signals readiness' do
    session.update!(status: 'active', started_at: Time.current)
    complete

    expect(response).to have_http_status(:conflict)
    expect(session.reload).to be_active
  end

  it 'rejects a stale readiness signal' do
    session.update!(status: 'active', started_at: Time.current,
                    audio_completion_ready_at: 3.minutes.ago)
    complete

    expect(response).to have_http_status(:conflict)
    expect(session.reload).to be_active
  end

  it 'ends once after a recent server readiness signal' do
    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_return('synthetic-job-id')
    session.update!(status: 'active', started_at: Time.current,
                    audio_completion_ready_at: Time.current)

    complete
    expect(response).to have_http_status(:ok)
    expect(session.reload).to be_ended
    expect(session.end_reason).to eq('all_covered')

    complete
    expect(response).to have_http_status(:ok)
    expect(PortfolioGeneratorWorker).to have_received(:perform_async).once
  end

  it 'ends the session but marks its portfolio failed when enqueue raises' do
    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_raise(Redis::CannotConnectError)
    session.update!(status: 'active', started_at: Time.current,
                    audio_completion_ready_at: Time.current)

    complete

    expect(response).to have_http_status(:ok)
    expect(session.reload).to be_ended
    expect(session.portfolio.reload.generation_status).to eq('failed')
    expect(session.portfolio.generation_error).to eq('EnqueueFailed')
  end

  it 'keeps a failed portfolio retryable when enqueue fails again' do
    user = User.create!(email: 'completion-assessor@example.test',
                        password: 'SyntheticPassword123!', role: 'admin', organization: organization)
    token = JsonWebToken.encode(user_id: user.id, role: 'admin', scheme: organization.scheme)
    headers = { 'Authorization' => "Bearer #{token}" }
    session.update!(status: 'ended', ended_at: Time.current)
    portfolio = Portfolio.create!(session: session, generation_status: 'failed',
                                  generation_error: 'EnqueueFailed')
    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_raise(Redis::CannotConnectError)

    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

    expect(response).to have_http_status(:service_unavailable)
    expect(portfolio.reload.generation_status).to eq('failed')
    expect(portfolio.generation_error).to eq('EnqueueFailed')

    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_return('synthetic-job-id')
    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

    expect(response).to have_http_status(:ok)
    expect(portfolio.reload.generation_status).to eq('pending')
  end

  it 'times out an abandoned queued portfolio and ignores its old worker after retry' do
    user = User.create!(email: 'timeout-assessor@example.test',
                        password: 'SyntheticPassword123!', role: 'admin', organization: organization)
    token = JsonWebToken.encode(user_id: user.id, role: 'admin', scheme: organization.scheme)
    headers = { 'Authorization' => "Bearer #{token}" }
    session.update!(status: 'ended', ended_at: Time.current)
    portfolio = Portfolio.create!(session: session, generation_status: 'pending',
                                  generation_attempt_token: 'old-attempt',
                                  generation_attempted_at: 3.minutes.ago)
    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_return('synthetic-job-id')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
    expect(response).to have_http_status(:ok)
    expect(portfolio.reload.generation_status).to eq('failed')
    expect(portfolio.generation_error).to eq('GenerationTimedOut')

    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
    expect(response).to have_http_status(:ok)
    new_token = portfolio.reload.generation_attempt_token
    expect(new_token).not_to eq('old-attempt')
    expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id, new_token)

    expect(Portfolios::Generator).not_to receive(:new)
    PortfolioGeneratorWorker.new.perform(session.id, 'old-attempt')
    expect(portfolio.reload.generation_status).to eq('pending')
  end

  it 'times out a generation interrupted after a worker started' do
    user = User.create!(email: 'running-assessor@example.test',
                        password: 'SyntheticPassword123!', role: 'admin', organization: organization)
    token = JsonWebToken.encode(user_id: user.id, role: 'admin', scheme: organization.scheme)
    session.update!(status: 'ended', ended_at: Time.current)
    portfolio = Portfolio.create!(session: session, generation_status: 'generating',
                                  generation_attempt_token: 'interrupted-attempt',
                                  generation_attempted_at: 6.minutes.ago)

    get "/api/v1/sessions/#{session.id}/portfolio",
        headers: { 'Authorization' => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    expect(portfolio.reload.generation_status).to eq('failed')
    expect(portfolio.generation_error).to eq('GenerationTimedOut')
  end

  it 'preserves the last complete portfolio when its refresh times out' do
    user = User.create!(email: 'refresh-assessor@example.test',
                        password: 'SyntheticPassword123!', role: 'admin', organization: organization)
    token = JsonWebToken.encode(user_id: user.id, role: 'admin', scheme: organization.scheme)
    session.update!(status: 'ended', ended_at: Time.current)
    portfolio = Portfolio.create!(session: session, generation_status: 'complete',
                                  generated_at: 1.day.ago,
                                  generation_attempt_token: 'interrupted-refresh',
                                  generation_attempted_at: 6.minutes.ago)

    get "/api/v1/sessions/#{session.id}/portfolio",
        headers: { 'Authorization' => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
    expect(portfolio.reload).to be_complete
    expect(portfolio.generation_error).to eq('GenerationTimedOut')
    expect(portfolio.generation_attempt_token).to be_nil
    expect(JSON.parse(response.body).dig('portfolio', 'generation_in_progress')).to be(false)
  end
end
