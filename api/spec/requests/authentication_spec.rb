# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication tenant binding', type: :request do
  let(:org)    { create_organization(scheme: 'test-corp') }
  let(:user)   { create_user(tenant: org) }

  before do
    # resolve_scheme reads the user's organization, so a real org is required.
    org
  end

  describe 'POST /api/v1/auth/login' do
    def login_with(scheme_header: nil)
      headers = { 'Content-Type' => 'application/json' }
      headers['X-Tenant-Scheme'] = scheme_header if scheme_header
      post '/api/v1/auth/login',
           params: { email: user.email, password: 'Password123!' }.to_json,
           headers: headers
    end

    it 'mints a token for the user\'s own tenant' do
      login_with
      expect(response).to have_http_status(:ok)
      token = JSON.parse(response.body)['token']
      payload = JWT.decode(token, JsonWebToken.send(:hmac_secret), true, algorithm: 'HS256').first
      expect(payload['scheme']).to eq('test-corp')
    end

    it 'ignores a client-supplied X-Tenant-Scheme (cross-tenant fix)' do
      login_with(scheme_header: 'victim-company')
      expect(response).to have_http_status(:ok)
      token = JSON.parse(response.body)['token']
      payload = JWT.decode(token, JsonWebToken.send(:hmac_secret), true, algorithm: 'HS256').first
      expect(payload['scheme']).to eq('test-corp')
    end

    it 'rejects a user with no tenant assigned' do
      user.update!(tenant_id: nil)
      login_with
      expect(response).to have_http_status(:forbidden)
    end

    it 'rejects a wrong password' do
      post '/api/v1/auth/login', params: { email: user.email, password: 'wrong' }.to_json,
                                 headers: { 'Content-Type' => 'application/json' }
      expect(response).to have_http_status(:unauthorized)
    end

    context 'when the credentials are right but the role has no access' do
      let(:non_assessor) { create_user(tenant: org, email: 'hr@example.test', role: 'user') }

      it 'answers 403, not the credential error' do
        post '/api/v1/auth/login',
             params: { email: non_assessor.email, password: 'Password123!' }.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(:forbidden)
      end

      it 'does not tell them their password is wrong' do
        # Sending someone to reset a password that already works guarantees they
        # never get in, however many times they try.
        post '/api/v1/auth/login',
             params: { email: non_assessor.email, password: 'Password123!' }.to_json,
             headers: { 'Content-Type' => 'application/json' }

        message = JSON.parse(response.body)['errors'].first['message']
        expect(message).not_to match(/password/i)
        expect(message).to match(/does not have access/i)
      end

      it 'still refuses to mint a token' do
        post '/api/v1/auth/login',
             params: { email: non_assessor.email, password: 'Password123!' }.to_json,
             headers: { 'Content-Type' => 'application/json' }

        expect(JSON.parse(response.body)).not_to have_key('token')
      end
    end
  end
end
