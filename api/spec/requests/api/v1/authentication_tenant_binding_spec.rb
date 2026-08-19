# frozen_string_literal: true

require 'rails_helper'

# Regression coverage for the login-time privilege escalation: previously
# AuthenticationController trusted a client-supplied X-Tenant-Scheme header
# (or an arbitrary fallback org) to decide which tenant a freshly minted JWT
# was scoped to, because `users` had no relationship to `organizations` at
# all. Login now derives `scheme` solely from the authenticated user's own
# organization; any X-Tenant-Scheme header on the login request is ignored.
RSpec.describe 'Authentication tenant binding', type: :request do
  let!(:org_a) { create(:organization) }
  let!(:org_b) { create(:organization) }
  let(:password) { "password123" }
  let!(:user_a)  { create(:user, organization: org_a, password:) }

  describe 'POST /api/v1/auth/login' do
    it "scopes the token to the user's own organization, ignoring X-Tenant-Scheme" do
      post '/api/v1/auth/login',
           params:  { email: user_a.email, password: },
           headers: { 'X-Tenant-Scheme' => org_b.scheme }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('organization', 'scheme')).to eq(org_a.scheme)
      expect(body.dig('organization', 'scheme')).not_to eq(org_b.scheme)

      decoded = JsonWebToken.decode(body['token'])
      expect(decoded[:scheme]).to eq(org_a.scheme)
    end

    it "issues a token that only sees the user's own tenant data, even when another tenant's scheme was requested" do
      assessment_a = create(:assessment, organization: org_a)
      assessment_b = create(:assessment, organization: org_b)

      post '/api/v1/auth/login',
           params:  { email: user_a.email, password: },
           headers: { 'X-Tenant-Scheme' => org_b.scheme }
      token = JSON.parse(response.body)['token']

      get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{token}" }

      ids = JSON.parse(response.body)['assessments'].map { |a| a['id'] }
      expect(ids).to include(assessment_a.id)
      expect(ids).not_to include(assessment_b.id)
    end

    it "rejects login when the user's tenant_id points at an org that no longer exists" do
      # tenant_id has no FK constraint (Organization is owned by the external
      # rakamin-api platform), so a dangling reference is a real possible
      # state, not just a hypothetical — e.g. the org was removed on the
      # platform side after this user was provisioned.
      dangling = create(:user, organization: org_a, password:)
      org_a.delete

      post '/api/v1/auth/login', params: { email: dangling.email, password: }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'rejects non-admin users regardless of tenant' do
      non_admin = create(:user, organization: org_a, role: 'user', password:)

      post '/api/v1/auth/login', params: { email: non_admin.email, password: }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
