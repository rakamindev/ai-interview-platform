# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'GET /api/v1/sessions/:token/candidate' do
  let(:assessment) { Assessment.create!(tenant_id: 1, created_by: 1, name: 'Backend Engineer', time_limit_min: 30) }

  it 'tells the candidate page why the session ended, so a failed session is not shown as complete' do
    session = Session.create!(assessment:, tenant_id: 1, status: 'ended', end_reason: 'error')

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to include('session_status' => 'ended', 'end_reason' => 'error')
  end

  it 'rejects an unknown invite token' do
    get '/api/v1/sessions/not-a-real-token/candidate'

    expect(response).to have_http_status(:not_found)
  end
end
