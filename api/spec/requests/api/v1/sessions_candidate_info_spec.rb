# frozen_string_literal: true

require 'rails_helper'

# AC-12: GET /api/v1/sessions/:token/candidate
# No JWT. The invite token in the URL is the only credential.
RSpec.describe 'GET /api/v1/sessions/:token/candidate', type: :request do
  let(:tenant_id) { 1 }

  let(:assessment) do
    Assessment.unscoped.create!(
      name: 'Backend Engineer',
      time_limit_min: 30,
      tenant_id: tenant_id,
      created_by: 1
    )
  end

  # unscoped: the model has a tenant scope, and this request is made without a tenant.
  def create_invite_session(status:, end_reason: nil)
    Session.unscoped.create!(
      assessment: assessment,
      tenant_id: tenant_id,
      status: status,
      end_reason: end_reason
    )
  end

  def get_candidate_info(token)
    get "/api/v1/sessions/#{token}/candidate"
  end

  def body
    JSON.parse(response.body)
  end

  # Valid token: always returns status and end_reason (AC-12)
  describe 'with a valid invite token' do
    it 'returns the session data for a pending session, with no end_reason' do
      session = create_invite_session(status: 'pending')

      get_candidate_info(session.invite_token)

      expect(response).to have_http_status(:ok)
      expect(body).to include(
        'session_id' => session.id,
        'role_title' => 'Backend Engineer',
        'time_limit_min' => 30,
        'session_status' => 'pending',
        'end_reason' => nil
      )
    end

    it 'returns end_reason "error" for an ended session that failed' do
      session = create_invite_session(status: 'ended', end_reason: 'error')

      get_candidate_info(session.invite_token)

      expect(response).to have_http_status(:ok)
      expect(body['session_status']).to eq('ended')
      expect(body['end_reason']).to eq('error')
    end

    %w[manual_candidate manual_assessor all_covered time_ceiling].each do |reason|
      it "returns end_reason \"#{reason}\" as it is stored" do
        session = create_invite_session(status: 'ended', end_reason: reason)

        get_candidate_info(session.invite_token)

        expect(body['end_reason']).to eq(reason)
      end
    end

    it 'returns the status for a failed session' do
      session = create_invite_session(status: 'failed')

      get_candidate_info(session.invite_token)

      expect(body['session_status']).to eq('failed')
    end

    it 'does not require an Authorization header' do
      session = create_invite_session(status: 'active')

      get "/api/v1/sessions/#{session.invite_token}/candidate", headers: {}

      expect(response).to have_http_status(:ok)
    end
  end

  # Invalid token: 404 and no session data (AC-12, AC-05)
  describe 'with an unknown invite token' do
    it 'returns 404 and none of the session fields' do
      create_invite_session(status: 'ended', end_reason: 'error') # a real session exists, but not this token

      get_candidate_info('this-token-does-not-exist')

      expect(response).to have_http_status(:not_found)
      expect(body.keys).not_to include('session_id', 'session_status', 'end_reason', 'role_title')
    end
  end
end