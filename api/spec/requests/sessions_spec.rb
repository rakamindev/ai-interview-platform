# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'POST /api/v1/assessments/:assessment_id/sessions', :aggregate_failures do
  let!(:organization) do
    Organization.create!(
      name: 'Test Corp',
      scheme: 'test-corp',
      identifier: 'test-corp',
      host: 'test.example.com'
    )
  end
  let!(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 7,
      name: 'Backend Engineer',
      time_limit_min: 30
    )
  end
  let(:headers) do
    token = JsonWebToken.encode(user_id: 7, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  around do |example|
    previous_app_base_url = ENV.fetch('APP_BASE_URL', nil)
    ENV['APP_BASE_URL'] = 'https://interviews.example.test/'
    example.run
  ensure
    ENV['APP_BASE_URL'] = previous_app_base_url
  end

  def submit_invite(candidate_name:)
    post "/api/v1/assessments/#{assessment.id}/sessions",
         params: { session: { candidate_name: } },
         headers: headers
  end

  it 'rejects a blank candidate name without creating a session' do
    expect { submit_invite(candidate_name: '   ') }.not_to change(Session, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body.dig('errors', 0, 'message')).to eq('Candidate name is required')
  end

  it 'trims the candidate name before creating a session' do
    expect { submit_invite(candidate_name: '  Budi Santoso  ') }.to change(Session, :count).by(1)

    expect(response).to have_http_status(:created)
    expect(response.parsed_body.dig('session', 'candidate_name')).to eq('Budi Santoso')
    expect(response.parsed_body.dig('session', 'invite_url'))
      .to eq("https://interviews.example.test/interview/#{Session.last.invite_token}")
  end
end
