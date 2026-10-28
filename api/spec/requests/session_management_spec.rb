# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session management', type: :request do
  let!(:organization) do
    Organization.create!(
      name: 'Spec Tenant', scheme: 'spec-tenant', identifier: 'spec-tenant', host: 'spec.local'
    )
  end
  let!(:assessment) do
    Assessment.create!(tenant_id: organization.id, created_by: 1, name: 'Frontend Engineer', time_limit_min: 45)
  end
  let(:headers) do
    token = JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  around do |example|
    previous_url = ENV['CANDIDATE_APP_BASE_URL']
    ENV['CANDIDATE_APP_BASE_URL'] = 'http://localhost:5173'
    example.run
    ENV['CANDIDATE_APP_BASE_URL'] = previous_url
  end

  it 'builds invite links for the candidate web app' do
    session = assessment.sessions.create!(tenant_id: organization.id)

    expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
  end

  it 'deletes a completed candidate record' do
    session = assessment.sessions.create!(tenant_id: organization.id, status: 'ended', end_reason: 'manual_assessor')

    delete "/api/v1/sessions/#{session.id}", headers: headers

    expect(response).to have_http_status(:no_content)
    expect(Session.unscoped.find_by(id: session.id)).to be_nil
  end

  it 'refuses to delete an active interview' do
    session = assessment.sessions.create!(tenant_id: organization.id, status: 'active', started_at: Time.current)

    delete "/api/v1/sessions/#{session.id}", headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(Session.unscoped.find_by(id: session.id)).to be_present
  end
end
