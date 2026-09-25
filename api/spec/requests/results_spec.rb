require 'rails_helper'

RSpec.describe 'Assessment results', type: :request do
  it 'denies cross-tenant export and override' do
    owner = organization('owner')
    outsider = organization('outsider')
    portfolio = portfolio_for(assessment_session(owner))
    skill = skill_for(portfolio)
    get "/api/v1/portfolios/#{portfolio.id}/export", headers: headers_for(outsider)
    expect(response).to have_http_status(:not_found)
    post "/api/v1/portfolio_skills/#{skill.id}/override", params: {override: {override_level: 1, assessor_notes: 'changed'}}, headers: headers_for(outsider)
    expect(response).to have_http_status(:not_found)
    expect(skill.reload.assessor_override).to be_nil
  end

  it 'returns current fit/gap without an AI call or background job' do
    org = organization
    portfolio = portfolio_for(assessment_session(org))
    skill_for(portfolio)
    vacancy = vacancy_for(org)
    expect(Gemini::HttpClient).not_to receive(:new)
    2.times { get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers_for(org) }
    expect(response).to have_http_status(:ok)
    comparison = response.parsed_body.fetch('report').fetch('skill_comparisons').first
    expect(comparison).to include('expected_level' => 3, 'candidate_level' => 3, 'result' => 'match', 'is_override' => false)
    expect(FitGapGeneratorWorker.jobs).to be_empty
  end

  it 'rejects premature audio completion' do
    session = assessment_session(organization, status: 'active')
    post "/api/v1/sessions/#{session.invite_token}/audio_complete"
    expect(response).to have_http_status(:conflict)
    expect(session.reload.status).to eq('active')
  end
end

RSpec.describe 'Local authentication', type: :request do
  it 'does not let a caller select another organization with a header' do
    owner = organization('owner')
    other = organization('other')
    user = User.create!(email: 'review@example.test', password: 'test-password-123', role: 'admin', organization_id: owner.id)
    post '/api/v1/auth/login', params: {email: user.email, password: 'test-password-123'}, headers: {'X-Tenant-Scheme' => other.scheme}
    expect(response).to have_http_status(:ok)
    expect(JsonWebToken.decode(response.parsed_body.fetch('token'))[:scheme]).to eq(owner.scheme)
  end

  it 'requires explicit membership when more than one organization exists' do
    organization('one'); organization('two')
    user = User.create!(email: 'unassigned@example.test', password: 'test-password-123', role: 'admin')
    post '/api/v1/auth/login', params: {email: user.email, password: 'test-password-123'}
    expect(response).to have_http_status(:forbidden)
  end

  it 'binds legacy single-organization users once for a compatible local login' do
    org = organization
    user = User.create!(email: 'legacy@example.test', password: 'test-password-123', role: 'admin')
    post '/api/v1/auth/login', params: {email: user.email, password: 'test-password-123'}
    expect(response).to have_http_status(:ok)
    expect(user.reload.organization_id).to eq(org.id)
  end
end

RSpec.describe 'Report authorization and recovery', type: :request do
  it 'denies cross-tenant fit/gap reads and triggers' do
    owner = organization('report-owner')
    outsider = organization('report-outsider')
    portfolio = portfolio_for(assessment_session(owner))
    vacancy = vacancy_for(outsider)
    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers_for(outsider)
    expect(response).to have_http_status(:not_found)
    post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: {vacancy_id: vacancy.id}, headers: headers_for(outsider)
    expect(response).to have_http_status(:not_found)
  end

  it 'exposes a recoverable queue failure instead of leaving a portfolio pending' do
    org = organization
    session = assessment_session(org)
    portfolio = session.create_portfolio!(generation_status: 'failed')
    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_raise(Redis::CannotConnectError)
    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers_for(org)
    expect(response).to have_http_status(:service_unavailable)
    expect(portfolio.reload).to be_failed
  end
end

RSpec.describe 'Candidate completion', type: :request do
  it 'accepts the server-authorized completion only once' do
    session = assessment_session(organization, status: 'active')
    session.update!(preparing_to_end_at: Time.current)
    allow_any_instance_of(Sessions::EndHandler).to receive(:publish_status_update)
    2.times do
      post "/api/v1/sessions/#{session.invite_token}/audio_complete"
      expect(response).to have_http_status(:ok)
    end
    expect(session.reload).to be_ended
    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
  end
end

RSpec.describe 'Connection test endpoints', type: :request do
  it 'downloads a bounded, uncached payload without authentication' do
    get '/api/v1/speed_test', params: { bytes: 1_000_000 }
    expect(response).to have_http_status(:ok)
    expect(response.headers['Cache-Control']).to eq('no-store')
    expect(response.body.bytesize).to eq(524_288)
  end

  it 'accepts the browser upload payload without authentication' do
    post '/api/v1/speed_test', params: ('x' * 262_144),
                               headers: { 'CONTENT_TYPE' => 'application/octet-stream' }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['received_bytes']).to eq(262_144)
  end

  it 'rejects uploads larger than the configured test limit' do
    post '/api/v1/speed_test', params: ('x' * 524_289),
                               headers: { 'CONTENT_TYPE' => 'application/octet-stream' }
    expect(response).to have_http_status(:payload_too_large)
  end
end
