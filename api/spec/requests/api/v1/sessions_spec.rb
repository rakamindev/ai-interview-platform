# frozen_string_literal: true

require 'rails_helper'

# rubocop:disable Metrics/BlockLength
RSpec.describe 'API V1 sessions', type: :request do
  let!(:organization) do
    Organization.create!(
      name: 'Test Corp',
      scheme: 'test-corp',
      identifier: 'test-corp',
      host: 'test.example.test'
    )
  end

  let!(:assessment) do
    Assessment.unscoped.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Senior Frontend Engineer',
      time_limit_min: 45,
      language: 'en'
    )
  end

  let(:auth_token) do
    JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)
  end

  let(:headers) do
    {
      'Authorization' => "Bearer #{auth_token}",
      'Content-Type' => 'application/json'
    }
  end

  around do |example|
    original_url = Rails.configuration.x.web_base_url
    Rails.configuration.x.web_base_url = 'https://web.example.test'
    example.run
  ensure
    Rails.configuration.x.web_base_url = original_url
  end

  it 'returns the canonical frontend invite URL consistently' do
    post "/api/v1/assessments/#{assessment.id}/sessions",
         params: { session: { candidate_name: 'Synthetic Candidate' } }.to_json,
         headers: headers

    expect(response).to have_http_status(:created)

    created_body = response.parsed_body
    created_session = created_body.fetch('session')
    expected_url = "https://web.example.test/interview/#{created_session.fetch('invite_token')}"

    aggregate_failures do
      expect(created_session.fetch('invite_url')).to eq(expected_url)
      expect(created_body.fetch('invite_url')).to eq(expected_url)
    end

    get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('sessions', 0, 'invite_url')).to eq(expected_url)

    get "/api/v1/sessions/#{created_session.fetch('id')}", headers: headers
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('session', 'invite_url')).to eq(expected_url)
  end
end
# rubocop:enable Metrics/BlockLength
