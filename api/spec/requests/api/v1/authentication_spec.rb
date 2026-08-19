# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  describe 'POST /api/v1/auth/login' do
    let!(:user) { create(:admin, email: 'admin@example.com', password: 'password123') }

    context 'with valid credentials' do
      it 'returns a token and user info' do
        post '/api/v1/auth/login', params: { email: 'admin@example.com', password: 'password123' }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body['token']).to be_present
        expect(body['user']['email']).to eq('admin@example.com')
        expect(body['user']['role']).to eq('admin')
      end
    end

    context 'with invalid password' do
      it 'returns unauthorized' do
        post '/api/v1/auth/login', params: { email: 'admin@example.com', password: 'wrong' }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'with non-existent email' do
      it 'returns unauthorized' do
        post '/api/v1/auth/login', params: { email: 'nobody@example.com', password: 'password123' }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'with non-admin user' do
      let!(:regular_user) { create(:user, email: 'user@example.com', password: 'password123') }

      it 'returns unauthorized' do
        post '/api/v1/auth/login', params: { email: 'user@example.com', password: 'password123' }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'with case-insensitive email' do
      it 'authenticates successfully' do
        post '/api/v1/auth/login', params: { email: 'ADMIN@EXAMPLE.COM', password: 'password123' }.to_json,
             headers: json_headers

        expect(response).to have_http_status(:ok)
        expect(JSON.parse(response.body)['token']).to be_present
      end
    end
  end
end
