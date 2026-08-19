# frozen_string_literal: true

require 'rails_helper'

# List-vs-detail contract for sessions: index rows carry the session shape
# only; show additionally embeds the assessment summary.
RSpec.describe 'Api::V1::Sessions (list vs detail contract)', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:admin) { create(:admin_user) }
  let(:headers) { auth_headers(scheme: org.scheme, user: admin) }

  SESSION_KEYS = %w[
    id assessment_id tenant_id candidate_id candidate_name
    invite_token invite_url status end_reason started_at ended_at
    duration_seconds expires_at revoked_at revoked expired created_at
  ].freeze
  SESSION_ASSESSMENT_KEYS = %w[id name role_title time_limit_min].freeze

  def session_with_assessment
    assessment = create(:assessment, tenant_id: org.id, name: 'Pilot', role_title: 'Engineer')
    create(:session, assessment: assessment, tenant_id: org.id)
  end

  describe 'GET /api/v1/assessments/:assessment_id/sessions' do
    it 'returns session-shape rows without the embedded assessment' do
      session = session_with_assessment

      get "/api/v1/assessments/#{session.assessment_id}/sessions", headers: headers

      expect(response).to have_http_status(:ok)
      row = JSON.parse(response.body)['sessions'].first
      expect_json_keys(row, SESSION_KEYS)
      expect(row['assessment']).to be_nil
    end
  end

  describe 'GET /api/v1/sessions/:id' do
    it 'returns the session shape plus the embedded assessment summary' do
      session = session_with_assessment

      get "/api/v1/sessions/#{session.id}", headers: headers

      expect(response).to have_http_status(:ok)
      detail = JSON.parse(response.body)['session']
      expect_json_keys(detail, SESSION_KEYS + ['assessment'])
      expect_json_keys(detail['assessment'], SESSION_ASSESSMENT_KEYS)
      expect(detail['assessment']['name']).to eq('Pilot')
    end
  end
end
