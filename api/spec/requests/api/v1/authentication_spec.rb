# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  describe 'POST /api/v1/auth/login' do
    it 'logs in an admin user and returns a JWT' do
      user = create(:user, email: 'admin@example.com', password: 'sekret123', role: 'admin')

      post '/api/v1/auth/login', params: { email: user.email, password: 'sekret123' }

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['token']).to be_present
      expect(body['user']).to include('id' => user.id, 'email' => user.email, 'role' => 'admin')

      decoded = JsonWebToken.decode(body['token'])
      expect(decoded['user_id']).to eq(user.id)
      expect(decoded['role']).to eq('admin')
    end

    it 'rejects a non-admin user even with the correct password' do
      user = create(:user, email: 'plain@example.com', password: 'sekret123', role: 'user')

      post '/api/v1/auth/login', params: { email: user.email, password: 'sekret123' }

      expect(response).to have_http_status(:unauthorized)
    end

    it 'rejects an incorrect password' do
      user = create(:user, email: 'admin2@example.com', password: 'sekret123', role: 'admin')

      post '/api/v1/auth/login', params: { email: user.email, password: 'wrong-password' }

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body['errors'].first['message']).to eq('Invalid email or password')
    end

    it 'rejects an unknown email' do
      post '/api/v1/auth/login', params: { email: 'nobody@example.com', password: 'whatever' }

      expect(response).to have_http_status(:unauthorized)
    end

    # P0 security fix — Rails logs `Parameters: {...}` for every request; without
    # filter_parameters configured, this would print the raw login password.
    it 'filters the password out of the request log parameters' do
      user = create(:user, email: 'admin3@example.com', password: 'sekret123', role: 'admin')

      post '/api/v1/auth/login', params: { email: user.email, password: 'sekret123' }

      expect(request.filtered_parameters['password']).to eq('[FILTERED]')
    end
  end
end
