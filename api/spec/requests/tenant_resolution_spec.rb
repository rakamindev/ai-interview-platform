# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tenant resolution hardening', type: :request do
  let(:middleware) { TenantResolverMiddleware.new(->(_env) { [200, {}, []] }) }

  describe 'forged JWT must not resolve a tenant' do
    it 'returns no scheme for a token with an invalid signature' do
      env = Rack::MockRequest.env_for(
        '/api/v1/assessments',
        'HTTP_AUTHORIZATION' => 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJzY2hlbWUiOiJ0ZXN0LWNvcnAifQ.FORGEDSIGNATURE'
      )
      request = ActionDispatch::Request.new(env)

      expect(middleware.send(:resolve_scheme, request)).to be_nil
    end

    it 'resolves the scheme only from a properly signed token' do
      org = create_organization(scheme: 'trusted-corp')
      token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme })

      env = Rack::MockRequest.env_for(
        '/api/v1/assessments',
        'HTTP_AUTHORIZATION' => "Bearer #{token}"
      )
      request = ActionDispatch::Request.new(env)

      expect(middleware.send(:resolve_scheme, request)).to eq('trusted-corp')
    end
  end

  describe 'cross-tenant data isolation' do
    let(:org_a) { create_organization(scheme: 'corp-a') }
    let(:org_b) { create_organization(scheme: 'corp-b') }
    let(:user_a) { create_user(tenant: org_a) }
    let(:assessment_b) { create_assessment(tenant: org_b, name: 'Secret of Corp B') }
    let(:token_a) { JsonWebToken.encode({ user_id: user_a.id, role: 'admin', scheme: org_a.scheme }) }

    it 'hides corp B resources from a corp A token' do
      get "/api/v1/assessments/#{assessment_b.id}", headers: { 'Authorization' => "Bearer #{token_a}" }

      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include('Secret of Corp B')
    end

    it 'shows only own-tenant resources in the list' do
      assessment_a = create_assessment(tenant: org_a, name: 'Visible of Corp A')

      get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{token_a}" }

      names = JSON.parse(response.body)['assessments'].map { |a| a['name'] }
      expect(names).to include('Visible of Corp A')
      expect(names).not_to include('Secret of Corp B')
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate on an ended session' do
    let(:org)        { create_organization }
    let(:assessment) { create_assessment(tenant: org) }
    let(:session)    { build_session(tenant: org, assessment: assessment) }

    it 'still returns 200 with status and consent fields' do
      create_consent(session: session, status: 'accepted')
      session.update!(status: 'ended', end_reason: 'all_covered')

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['session_status']).to eq('ended')
      expect(body['consent_status']).to eq('accepted')
    end
  end
end
