# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Candidate interview resume', type: :request do
  let(:suffix) { SecureRandom.hex(4) }
  let(:org) do
    Organization.create!(
      name: "Resume Corp #{suffix}",
      scheme: "resume-#{suffix}",
      identifier: "resume-#{suffix}",
      host: "resume-#{suffix}.test.local"
    )
  end
  let(:assessment) do
    Current.using(tenant_id: org.id) do
      Assessment.create!(
        name: 'Resume assessment',
        tenant_id: org.id,
        created_by: 1,
        time_limit_min: 30
      )
    end
  end

  def create_candidate_session(**attributes)
    Current.using(tenant_id: org.id) do
      Session.create!({
        assessment_id: assessment.id,
        tenant_id: org.id,
        candidate_name: 'Disposable candidate'
      }.merge(attributes))
    end
  end

  it 'returns the original deadline and the last 20 transcript turns in chronological order' do
    started_at = 7.minutes.ago.change(usec: 0)
    session = create_candidate_session(
      status: 'active',
      started_at: started_at,
      gemini_resumption_token: 'resume-handle'
    )
    25.times do |index|
      session.transcript_turns.create!(
        turn_number: index + 1,
        speaker: index.even? ? 'ai' : 'candidate',
        text: "Turn #{index + 1}"
      )
    end

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    expect(response).to have_http_status(:ok)
    payload = JSON.parse(response.body)
    expect(payload).to include(
      'session_status' => 'active',
      'resume_available' => true,
      'deadline_at' => (started_at + 30.minutes).iso8601
    )
    expect(payload['remaining_seconds']).to be_between(1_379, 1_380)
    expect(payload['recent_transcript'].map { |turn| turn['turn_number'] }).to eq((6..25).to_a)
  end

  it 'reports an unavailable recovery state instead of pretending context can resume' do
    session = create_candidate_session(status: 'active', started_at: 1.minute.ago, gemini_resumption_token: nil)

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    payload = JSON.parse(response.body)
    expect(payload['resume_available']).to be(false)
    expect(payload['recovery_message']).to be_present
  end

  it 'does not expose transcript or deadline for a pending session' do
    session = create_candidate_session(status: 'pending')

    get "/api/v1/sessions/#{session.invite_token}/candidate"

    payload = JSON.parse(response.body)
    expect(payload['deadline_at']).to be_nil
    expect(payload['remaining_seconds']).to be_nil
    expect(payload['recent_transcript']).to eq([])
  end
end
