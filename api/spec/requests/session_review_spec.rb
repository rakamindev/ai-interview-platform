# frozen_string_literal: true

require 'rails_helper'

# Marking a candidate reviewed. The candidate list is a queue, and a queue
# nobody can clear stops carrying information — after fifty candidates
# "ready to review" would mean nothing more than "finished".
RSpec.describe 'PATCH /api/v1/sessions/:id/review', type: :request do
  let(:org)        { create_organization(scheme: 'test-corp') }
  let(:user)       { create_user(tenant: org) }
  let(:token)      { JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: org.scheme }) }
  let(:headers)    { { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' } }
  let(:assessment) { create_assessment(tenant: org) }
  let(:session)    { build_session(tenant: org, assessment: assessment) }

  def complete_report!
    session.update!(status: 'ended', end_reason: 'all_covered')
    Portfolio.create!(session_id: session.id, generation_status: 'complete')
  end

  def review!(body = nil)
    patch "/api/v1/sessions/#{session.id}/review", params: body&.to_json, headers: headers
  end

  context 'when a finished report exists' do
    before { complete_report! }

    it 'records who reviewed it and when' do
      review!

      expect(response).to have_http_status(:ok)
      session.reload
      expect(session.reviewed_at).to be_present
      expect(session.reviewed_by).to eq(user.id)
    end

    it 'returns the new state so the list can update without refetching' do
      review!

      expect(JSON.parse(response.body)['session']['reviewed_at']).to be_present
    end

    it 'does not move the timestamp when pressed twice' do
      review!
      first = session.reload.reviewed_at

      travel_to(2.hours.from_now) { review! }

      expect(session.reload.reviewed_at).to be_within(1.second).of(first)
    end

    it 'can be undone, because people mark the wrong row' do
      review!
      expect(session.reload.reviewed_at).to be_present

      review!(reviewed: false)

      expect(response).to have_http_status(:ok)
      expect(session.reload.reviewed_at).to be_nil
      expect(session.reviewed_by).to be_nil
    end
  end

  context 'when there is nothing to read yet' do
    it 'refuses a session whose report is still generating' do
      session.update!(status: 'ended', end_reason: 'all_covered')
      Portfolio.create!(session_id: session.id, generation_status: 'generating')

      review!

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.reviewed_at).to be_nil
    end

    it 'refuses a session with no portfolio at all' do
      review!

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.reviewed_at).to be_nil
    end

    it 'says what is missing rather than failing silently' do
      review!

      message = JSON.parse(response.body)['errors'].first['message']
      expect(message).to match(/no finished report/i)
    end
  end

  describe 'authorisation' do
    it 'refuses an unauthenticated request' do
      complete_report!

      patch "/api/v1/sessions/#{session.id}/review", headers: { 'Content-Type' => 'application/json' }

      expect(response).not_to have_http_status(:ok)
      expect(session.reload.reviewed_at).to be_nil
    end

    it "cannot reach another tenant's session" do
      other_org = create_organization(scheme: 'victim-corp')
      victim_assessment = create_assessment(tenant: other_org, name: 'VICTIM Role')
      victim = Session.unscoped.create!(
        tenant_id: other_org.id, assessment_id: victim_assessment.id,
        status: 'ended', end_reason: 'all_covered', invite_token: SecureRandom.hex(32)
      )
      Portfolio.create!(session_id: victim.id, generation_status: 'complete')

      patch "/api/v1/sessions/#{victim.id}/review", headers: headers

      expect(response).to have_http_status(:not_found)
      expect(victim.reload.reviewed_at).to be_nil
    end
  end

  describe 'the candidate list' do
    it 'reports reviewed_at so the queue can be filtered' do
      complete_report!
      review!

      get '/api/v1/sessions/candidates', headers: headers

      row = JSON.parse(response.body)['sessions'].first
      expect(row['reviewed_at']).to be_present
    end
  end
end
