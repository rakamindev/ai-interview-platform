# frozen_string_literal: true

require 'rails_helper'

# REST regression gate for F-02: confirms the REST authz policy is UNCHANGED.
# The WebSocket fix must not regress REST — assessor endpoints still reject
# non-assessor roles and accept assessor/admin roles.
RSpec.describe 'Sessions API (REST regression gate)', type: :request do
  let(:org) do
    Organization.create!(
      name: 'Alpha Corp',
      scheme: 'alpha-test',
      identifier: 'alpha-test',
      host: 'alpha.test.local'
    )
  end

  let(:assessment) do
    Current.using(tenant_id: org.id) do
      Assessment.create!(name: 'F02', tenant_id: org.id, created_by: 1, time_limit_min: 30)
    end
  end

  let(:session) do
    Current.using(tenant_id: org.id) do
      Session.create!(
        assessment_id: assessment.id, tenant_id: org.id,
        candidate_id: 'cand-1', candidate_name: 'Cand', status: 'active'
      )
    end
  end

  def token(role)
    JsonWebToken.encode({ user_id: 1, role: role, scheme: org.scheme })
  end

  describe 'GET /api/v1/sessions/:id (assessor-protected)' do
    it 'accepts an assessor role (200)' do
      get "/api/v1/sessions/#{session.id}",
          headers: { 'Authorization' => "Bearer #{token('assessor')}" }
      expect(response).to have_http_status(:ok)
    end

    it 'accepts an admin role (200)' do
      get "/api/v1/sessions/#{session.id}",
          headers: { 'Authorization' => "Bearer #{token('admin')}" }
      expect(response).to have_http_status(:ok)
    end

    it 'rejects a user role (401/403 — REST policy unchanged)' do
      get "/api/v1/sessions/#{session.id}",
          headers: { 'Authorization' => "Bearer #{token('user')}" }
      expect(response.status).to be_in([401, 403])
    end
  end
end
