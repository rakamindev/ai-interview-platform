# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  describe 'POST /api/v1/auth/login' do
    let!(:admin_user) { create(:user, :admin, email: 'admin@test.com', password: 'password123') }

    context 'with valid admin credentials' do
      before { post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'password123' } }

      it 'returns HTTP 200 with token' do
        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['token']).to be_present
        expect(json['user']['email']).to eq('admin@test.com')
      end
    end

    context 'with wrong password' do
      before { post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'wrong' } }

      it 'returns HTTP 401' do
        expect(response).to have_http_status(:unauthorized)
        json = JSON.parse(response.body)
        expect(json['errors'][0]['message']).to eq('Invalid email or password')
      end
    end

    context 'with non-admin user' do
      before do
        create(:user, :user_role, email: 'user@test.com', password: 'password123')
        post '/api/v1/auth/login', params: { email: 'user@test.com', password: 'password123' }
      end

      it 'returns HTTP 401' do
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'with missing params' do
      it 'returns HTTP 401' do
        post '/api/v1/auth/login', params: {}
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
