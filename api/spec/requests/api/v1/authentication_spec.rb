# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp') }
  let!(:admin_user) { create(:user, email: 'admin@rakamin.com', role: 'admin', password: 'password123') }

  describe 'POST /api/v1/auth/login' do
    it 'authenticates admin user with valid credentials' do
      post '/api/v1/auth/login', params: { email: 'admin@rakamin.com', password: 'password123' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['token']).to be_present
      expect(json['user']['email']).to eq('admin@rakamin.com')
      expect(json['user']['role']).to eq('admin')
    end

    it 'returns unauthorized on invalid credentials' do
      post '/api/v1/auth/login', params: { email: 'admin@rakamin.com', password: 'wrongpassword' }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'POST /api/v1/auth/google' do
    it 'authenticates assessor with valid Google email' do
      post '/api/v1/auth/google', params: { email: 'admin@rakamin.com' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['token']).to be_present
      expect(json['user']['email']).to eq('admin@rakamin.com')
      expect(json['provider']).to eq('google')
    end

    it 'auto-provisions new assessor with Rakamin corporate email in dev/test' do
      post '/api/v1/auth/google', params: { email: 'new.assessor@rakamin.com' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['token']).to be_present
      expect(json['user']['email']).to eq('new.assessor@rakamin.com')
      expect(json['user']['role']).to eq('admin')
    end

    it 'rejects unauthorized non-admin accounts' do
      non_admin = create(:user, email: 'external@otherdomain.org', role: 'user', password: 'password123')
      post '/api/v1/auth/google', params: { email: non_admin.email }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'auto-provisions new user with any Google email (including @gmail.com) in dev/test' do
      post '/api/v1/auth/google', params: { email: 'random.person@gmail.com' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['token']).to be_present
      expect(json['user']['email']).to eq('random.person@gmail.com')
      expect(json['user']['role']).to eq('admin')
    end
  end
end
