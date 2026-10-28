# frozen_string_literal: true

require 'rails_helper'

# AC7.3, AC8.1 and F6: while a generation is running (including between retries) it cannot be
# started again; a run that has stalled can.
RSpec.describe 'Portfolio generation status', type: :request do
  let(:org) { create(:organization) }
  let(:headers) { auth_headers_for(org) }
  let(:session) { create(:session, organization: org, ended_at: 1.hour.ago) }

  def regenerate
    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
  end

  def json
    JSON.parse(response.body)
  end

  it 'refuses to start a second run while one is in progress' do
    create(:portfolio, session: session, generation_status: 'generating', generation_started_at: 2.minutes.ago)

    regenerate

    expect(response).to have_http_status(:conflict)
    expect(PortfolioGeneratorWorker.jobs).to be_empty
  end

  it 'restarts a run that has stalled, and resets the attempt count' do
    portfolio = create(:portfolio, session: session, generation_status: 'generating', generation_attempts: 2,
                                   generation_started_at: 25.minutes.ago)

    regenerate

    expect(response).to have_http_status(:ok)
    expect(portfolio.reload).to have_attributes(generation_status: 'pending', generation_attempts: 0)
    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
  end

  it 'does not let a second click restart a run that was just queued' do
    create(:portfolio, session: session, generation_status: 'failed')

    regenerate
    regenerate

    expect(response).to have_http_status(:conflict)
    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
  end

  it 'treats a pending portfolio that never started as stalled after the timeout' do
    create(:portfolio, session: session, generation_status: 'pending', generation_started_at: nil)

    regenerate

    expect(response).to have_http_status(:ok)
  end

  it 'restarts a failed run' do
    create(:portfolio, session: session, generation_status: 'failed', generation_error: 'The AI model did not respond in time.')

    regenerate

    expect(response).to have_http_status(:ok)
  end

  it 'reports progress while generating' do
    create(:portfolio, session: session, generation_status: 'generating', generation_attempts: 2,
                       generation_started_at: 1.minute.ago, generation_error: 'The AI model is overloaded (HTTP 503).')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(response).to have_http_status(:accepted)
    expect(json).to include('status' => 'generating')
    expect(json['portfolio']).to include('generation_attempts' => 2, 'stale' => false,
                                         'generation_error' => 'The AI model is overloaded (HTTP 503).')
  end

  it 'flags a stalled run in the payload' do
    create(:portfolio, session: session, generation_status: 'generating', generation_started_at: 30.minutes.ago)

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(json.dig('portfolio', 'stale')).to be(true)
  end
end
