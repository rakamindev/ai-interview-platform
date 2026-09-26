# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate page data', type: :request do
  let(:assessment) { create(:assessment, language: 'id', time_limit_min: 45) }

  it 'tells the candidate how their interview really ended' do
    interview = create(:session, assessment: assessment, status: 'ended', end_reason: 'error',
                                 started_at: 8.seconds.ago, ended_at: Time.current, duration_seconds: 8)

    get "/api/v1/sessions/#{interview.invite_token}/candidate"

    body = JSON.parse(response.body)
    expect(response).to have_http_status(:ok)
    expect(body).to include('outcome' => 'failed', 'reference' => "R-#{interview.id}", 'language' => 'id',
                            'duration_seconds' => 8, 'session_status' => 'ended')
    expect(body['ended_at']).to be_present
  end

  it 'has no outcome before the interview ends' do
    interview = create(:session, assessment: assessment, status: 'pending', end_reason: nil)

    get "/api/v1/sessions/#{interview.invite_token}/candidate"

    expect(JSON.parse(response.body)['outcome']).to be_nil
  end

  it 'answers an unknown link with a stable code' do
    get '/api/v1/sessions/not-a-real-token/candidate'

    expect(response).to have_http_status(:not_found)
    expect(JSON.parse(response.body)['errors'].first['code']).to eq('invalid_link')
  end
end
