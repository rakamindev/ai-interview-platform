# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication API', type: :request do
  # Tenant must resolve for every request (ApplicationController#require_tenant!).
  let(:organization) { create(:organization, scheme: 'test-corp') }

  before { organization }

  describe 'POST /api/v1/auth/signup' do
    let(:attrs) { { email: 'new.assessor@test.com', password: 'password123' } }

    it 'creates an admin user, returns a token, and encodes the right claims' do
      expect { post_signup(attrs) }.to change(User, :count).by(1)

      expect(response).to have_http_status(:created)

      body = json_body
      expect(body['token']).to be_present
      expect(body['user']).to include(
        'email' => 'new.assessor@test.com',
        'role' => 'admin'
      )

      claims = JsonWebToken.decode_without_verification(body['token'])
      expect(claims[:user_id]).to eq(User.last.id)
      expect(claims[:role]).to eq('admin')
      expect(claims[:scheme]).to eq('test-corp')
    end

    # This route is intentionally public — no Authorization header is sent by
    # the helper, so reaching 201 proves signup does not require a prior session.
    it 'is reachable without an Authorization header' do
      post_signup(attrs)

      expect(response).to have_http_status(:created)
    end

    it 'ignores a client-supplied role and always creates an admin' do
      post_signup(attrs.merge(role: 'user'))

      expect(response).to have_http_status(:created)
      expect(json_body['user']['role']).to eq('admin')
      expect(User.last.role).to eq('admin')
    end

    it 'rejects a duplicate email regardless of case' do
      create(:user, email: 'new.assessor@test.com')

      post_signup(attrs.merge(email: 'NEW.ASSESSOR@test.com'))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body['errors'].first['message']).to eq('Email has already been taken')
    end

    it 'rejects a malformed email' do
      post_signup(attrs.merge(email: 'not-an-email'))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body['errors'].first['message']).to include('Email is invalid')
    end

    it 'rejects a password shorter than 8 characters' do
      post_signup(attrs.merge(password: 'short'))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body['errors'].first['message']).to include('Password is too short')
    end

    it 'encodes the custom tenant scheme into the token' do
      create(:organization, scheme: 'acme')

      post_signup(attrs, 'X-Tenant-Scheme' => 'acme')

      expect(response).to have_http_status(:created)
      claims = JsonWebToken.decode_without_verification(json_body['token'])
      expect(claims[:scheme]).to eq('acme')
    end

    # require_tenant! is skipped for auth routes, so a header-less request is
    # still accepted. resolve_scheme falls back: header → first org row → 'test-corp'.
    it 'falls back to the first organization scheme when no header is sent' do
      post '/api/v1/auth/signup', params: attrs

      expect(response).to have_http_status(:created)

      claims = JsonWebToken.decode_without_verification(json_body['token'])
      expect(claims[:scheme]).to eq(Organization.first.scheme)
    end

    it 'falls back to the default scheme when no header or organization exists' do
      Organization.delete_all

      post '/api/v1/auth/signup', params: attrs

      expect(response).to have_http_status(:created)

      claims = JsonWebToken.decode_without_verification(json_body['token'])
      expect(claims[:scheme]).to eq('test-corp')
    end
  end

  describe 'POST /api/v1/auth/login' do
    let(:password) { 'password123' }
    let!(:user) { create(:user, email: 'admin@test.com', password:) }

    it 'returns a token and profile for a valid admin' do
      post_login(email: 'admin@test.com', password:)

      expect(response).to have_http_status(:ok)

      body = json_body
      expect(body['token']).to be_present
      expect(body['user']).to include('email' => 'admin@test.com', 'role' => 'admin')

      claims = JsonWebToken.decode_without_verification(body['token'])
      expect(claims[:user_id]).to eq(user.id)
      expect(claims[:role]).to eq('admin')
      expect(claims[:scheme]).to eq('test-corp')
    end

    it 'matches email case-insensitively' do
      post_login(email: 'ADMIN@test.com', password:)

      expect(response).to have_http_status(:ok)
    end

    it 'rejects a wrong password' do
      post_login(email: 'admin@test.com', password: 'wrong-password')

      expect(response).to have_http_status(:unauthorized)
      expect(json_body['errors'].first['message']).to eq('Invalid email or password')
    end

    it 'rejects an unknown email' do
      post_login(email: 'nobody@test.com', password:)

      expect(response).to have_http_status(:unauthorized)
      expect(json_body['errors'].first['message']).to eq('Invalid email or password')
    end

    it 'rejects non-admin roles (assessor-only app)' do
      create(:user, email: 'viewer@test.com', password:, role: 'user')

      post_login(email: 'viewer@test.com', password:)

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
