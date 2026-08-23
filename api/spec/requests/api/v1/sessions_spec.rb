# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate sessions', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment) do
    create(:assessment,
           tenant_id: organization.id,
           name: 'Original Role',
           time_limit_min: 45,
           language: 'en')
  end
  let(:headers) do
    token = JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end

  before do
    create(:assessment_skill, assessment:, display_order: 0, skill_id: 'react', skill_label: 'React')
  end

  it 'captures a published version, reuses it, and publishes the next revision after an edit' do
    post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: { candidate_name: 'Ari' } }, headers: headers

    expect(response).to have_http_status(:created)
    first_session = response.parsed_body.fetch('session')
    expect(first_session.dig('rubric', 'status')).to eq('captured')
    expect(first_session.dig('rubric', 'version')).to eq(1)

    post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: { candidate_name: 'Bima' } }, headers: headers

    expect(response).to have_http_status(:created)
    expect(response.parsed_body.dig('session', 'rubric', 'version')).to eq(1)
    expect(assessment.assessment_versions.count).to eq(1)

    allow(SystemPromptGeneratorWorker).to receive(:perform_async)
    put "/api/v1/assessments/#{assessment.id}",
        params: { assessment: { name: 'Updated Role', time_limit_min: 45, language: 'en' } },
        headers: headers

    expect(response).to have_http_status(:ok)
    expect(assessment.reload.rubric_version).to eq(2)

    post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: { candidate_name: 'Citra' } }, headers: headers

    expect(response).to have_http_status(:created)
    expect(response.parsed_body.dig('session', 'rubric', 'version')).to eq(2)
    expect(assessment.assessment_versions.count).to eq(2)
  end

  it 'rejects invitations from an assessment without skills' do
    assessment.assessment_skills.destroy_all

    post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: {} }, headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body.dig('errors', 0, 'message')).to match(/at least one skill/)
    expect(assessment.sessions).to be_empty
  end

  it 'returns the captured role and time limit to the candidate after the template changes' do
    post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: {} }, headers: headers
    invite_token = response.parsed_body.dig('session', 'invite_token')

    assessment.with_lock do
      assessment.update!(name: 'Changed Template Role', time_limit_min: 60)
      assessment.increment!(:rubric_version)
    end

    get "/api/v1/sessions/#{invite_token}/candidate"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to include('role_title' => 'Original Role', 'time_limit_min' => 45)
  end

  it 'returns the published rubric details needed to compare candidate sessions' do
    post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: {} }, headers: headers

    assessment.with_lock do
      assessment.update!(name: 'Updated Role', time_limit_min: 60)
      assessment.assessment_skills.first.update!(l3_anchor: 'Updated L3 anchor', expected_level: 4)
      assessment.increment!(:rubric_version)
    end
    post "/api/v1/assessments/#{assessment.id}/sessions", params: { session: {} }, headers: headers

    get "/api/v1/assessments/#{assessment.id}/versions", headers: headers

    expect(response).to have_http_status(:ok)
    versions = response.parsed_body.fetch('versions')
    expect(versions.map { |version| version.fetch('rubric_version') }).to eq([2, 1])
    expect(versions.first).to include('name' => 'Updated Role', 'time_limit_min' => 60)
    expect(versions.first.fetch('skills').first).to include('l3_anchor' => 'Updated L3 anchor', 'expected_level' => 4)
    expect(versions.last).to include('name' => 'Original Role', 'time_limit_min' => 45)
    expect(versions.last.fetch('skills').first).to include('l3_anchor' => 'Handles complex work', 'expected_level' => 3)
  end
end
