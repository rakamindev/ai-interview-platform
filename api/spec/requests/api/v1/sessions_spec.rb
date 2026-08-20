# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session invite regeneration', type: :request do
  it 'resets the failed session in place and preserves the candidate identity' do
    organization = create_organization
    assessment = create_assessment(organization)
    session = create_interview_session(
      assessment,
      candidate_id: 42,
      candidate_name: 'Ayu Pratama',
      status: 'ended',
      end_reason: 'error',
      error_message: 'Connection failed',
      started_at: 5.minutes.ago,
      ended_at: 1.minute.ago,
      duration_seconds: 240,
      gemini_resumption_token: 'stale-token'
    )
    old_invite_token = session.invite_token
    session.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'Partial answer')
    session.coverage_maps.create!(skill_label: 'Ruby', is_discovered: false, state: 'partial', probe_count: 1)
    session.create_portfolio!(candidate_id: 42, generation_status: 'pending')

    post "/api/v1/sessions/#{session.id}/regenerate_invite", headers: assessor_headers(organization)

    expect(response).to have_http_status(:ok)
    session.reload
    expect(session).to have_attributes(
      id: session.id,
      candidate_id: 42,
      candidate_name: 'Ayu Pratama',
      status: 'pending',
      end_reason: nil,
      error_message: nil,
      started_at: nil,
      ended_at: nil,
      duration_seconds: nil,
      gemini_resumption_token: nil
    )
    expect(session.invite_token).not_to eq(old_invite_token)
    expect(session.transcript_turns).to be_empty
    expect(session.coverage_maps).to be_empty
    expect(session.portfolio).to be_nil
    expect(response_json.dig('session', 'id')).to eq(session.id)
    expect(response_json.dig('session', 'status')).to eq('pending')
  end

  it 'rejects regeneration for a session that has not failed' do
    organization = create_organization
    assessment = create_assessment(organization)
    session = create_interview_session(assessment, status: 'pending')
    old_invite_token = session.invite_token

    post "/api/v1/sessions/#{session.id}/regenerate_invite", headers: assessor_headers(organization)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(session.reload.invite_token).to eq(old_invite_token)
    expect(session.status).to eq('pending')
  end

  it 'requires recruiter authentication' do
    organization = create_organization
    assessment = create_assessment(organization)
    session = create_interview_session(assessment, status: 'ended', end_reason: 'error')

    post "/api/v1/sessions/#{session.id}/regenerate_invite", headers: { 'X-Tenant-Scheme' => organization.scheme }

    expect(response).to have_http_status(:unauthorized)
  end
end
