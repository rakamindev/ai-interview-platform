# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessment summaries', type: :request do
  it 'returns candidate counts for every lifecycle status' do
    organization = create_organization
    assessment = create_assessment(organization)
    create_interview_session(assessment, status: 'pending')
    create_interview_session(assessment, status: 'active', started_at: 1.minute.ago)
    create_interview_session(assessment, status: 'ended', end_reason: 'manual_candidate', ended_at: Time.current)
    create_interview_session(assessment, status: 'ended', end_reason: 'error', ended_at: Time.current)
    create_interview_session(assessment, status: 'failed')

    get '/api/v1/assessments', headers: assessor_headers(organization)

    expect(response).to have_http_status(:ok)
    summary = response_json.dig('assessments', 0, 'session_summary')
    expect(summary).to eq(
      'total' => 5,
      'awaiting' => 1,
      'in_progress' => 1,
      'completed' => 1,
      'failed' => 2
    )
  end
end
