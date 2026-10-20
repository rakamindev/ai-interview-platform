# frozen_string_literal: true

require 'rails_helper'

# P1-7: Rails writes `request.filtered_parameters` to the request log ("Parameters: {...}"). These specs send real
# requests and check what that log line would contain, so a key missing from `filter_parameters` shows up here.
RSpec.describe 'Parameter logging (P1-7)', type: :request do
  let(:organization) { create(:organization) }
  let(:headers)      { auth_headers_for(organization) }

  def logged = request.filtered_parameters

  it 'filters the password and email from a login' do
    create(:user, email: 'assessor@example.test', password: 'correct-horse-battery')

    post '/api/v1/auth/login', params: { email: 'assessor@example.test', password: 'correct-horse-battery' }.to_json,
                               headers: { 'Content-Type' => 'application/json' }

    expect(response).to have_http_status(:ok)
    expect(logged).to include('password' => '[FILTERED]', 'email' => '[FILTERED]')
  end

  it "filters the assessor's notes from an override" do
    portfolio = create(:portfolio, session: create(:session, :ended, assessment: create(:assessment, organization:)))
    skill     = create(:portfolio_skill, portfolio:)

    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: 4, assessor_notes: 'Stronger than the AI thought' } }.to_json, headers: headers

    expect(response).to have_http_status(:created)
    expect(logged.dig('override', 'assessor_notes')).to eq('[FILTERED]')
    expect(logged.dig('override', 'override_level')).to eq(4)
  end

  it "filters the candidate's name when an assessor creates an invite" do
    assessment = create(:assessment, organization:)

    post "/api/v1/assessments/#{assessment.id}/sessions",
         params: { session: { candidate_name: 'Test Candidate' } }.to_json, headers: headers

    expect(response).to have_http_status(:created)
    expect(logged.dig('session', 'candidate_name')).to eq('[FILTERED]')
  end

  it "filters the candidate's invite token, which is all it takes to join their interview" do
    session = create(:session, assessment: create(:assessment, organization:))

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    expect(response).to have_http_status(:ok)
    expect(logged['token']).to eq('[FILTERED]')
  end
end
