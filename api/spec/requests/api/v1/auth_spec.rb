require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  let!(:user) { create(:user, :admin, email: 'admin@test.com', password: 'password123') }

  describe 'POST /api/v1/auth/login' do
    context 'with valid credentials' do
      it 'returns JWT token' do
        post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'password123' }

        expect_json_response
        expect(json_body['token']).to be_present

        # Verify token can be decoded
        decoded = JsonWebToken.decode(json_body['token'])
        expect(decoded[:user_id]).to eq(user.id)
      end
    end

    context 'with invalid password' do
      it 'returns 401' do
        post '/api/v1/auth/login', params: { email: 'admin@test.com', password: 'wrong' }

        expect_error(status: :unauthorized)
      end
    end

    context 'with non-existent email' do
      it 'returns 401' do
        post '/api/v1/auth/login', params: { email: 'nonexistent@test.com', password: 'password123' }

        expect_error(status: :unauthorized)
      end
    end
  end
end