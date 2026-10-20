# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session invite URL contract', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization:) }
  let(:headers) { assessor_headers(organization) }

  around do |example|
    previous = ENV['CANDIDATE_APP_URL']
    ENV['CANDIDATE_APP_URL'] = 'http://localhost:5173/'
    example.run
  ensure
    ENV['CANDIDATE_APP_URL'] = previous
  end

  it 'returns a normalized frontend candidate URL when creating a session' do
    post "/api/v1/assessments/#{assessment.id}/sessions",
         params: { session: { candidate_name: 'Synthetic Candidate' } },
         headers:,
         as: :json

    expect(response).to have_http_status(:created)

    invite_url = JSON.parse(response.body).fetch('session').fetch('invite_url')
    invite_token = JSON.parse(response.body).fetch('session').fetch('invite_token')

    expect(invite_url).to eq("http://localhost:5173/interview/#{invite_token}")
  end
end
