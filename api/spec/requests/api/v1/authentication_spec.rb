require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  let(:password) { 'password123' }
  let!(:user) { User.create!(email: 'test@example.com', password: password, role: 'admin') }
  
  before do
    Organization.create!(scheme: 'test-corp', name: 'Test Corp', identifier: 'test-corp')
  end

  describe 'POST /api/v1/auth/login' do
    it 'returns a JWT token for valid credentials' do
      post '/api/v1/auth/login', params: { email: user.email, password: password }
      expect(response).to have_http_status(:success)
      expect(JSON.parse(response.body)['token']).not_to be_nil
    end

    it 'returns unauthorized for invalid password' do
      post '/api/v1/auth/login', params: { email: user.email, password: 'wrongpassword' }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'POST /api/v1/auth/register' do
    it 'creates a new user and returns a token' do
      expect {
        post '/api/v1/auth/register', params: { email: 'new@example.com', password: 'newpassword123' }
      }.to change(User, :count).by(1)
      
      expect(response).to have_http_status(:success)
      expect(JSON.parse(response.body)['token']).not_to be_nil
    end
  end

  describe 'POST /api/v1/auth/forgot_password' do
    it 'generates reset token and sends email for valid user' do
      expect {
        post '/api/v1/auth/forgot_password', params: { email: user.email }
      }.to change { ActionMailer::Base.deliveries.count }.by(1)
      
      expect(response).to have_http_status(:success)
      expect(user.reload.reset_password_token).not_to be_nil
    end

    it 'still returns success for invalid email (prevents enumeration)' do
      post '/api/v1/auth/forgot_password', params: { email: 'notfound@example.com' }
      expect(response).to have_http_status(:success)
    end
  end

  describe 'POST /api/v1/auth/reset_password' do
    before do
      user.generate_password_reset_token!
    end

    it 'resets password with valid token' do
      post '/api/v1/auth/reset_password', params: { token: user.reset_password_token, password: 'newpassword123' }
      expect(response).to have_http_status(:success)
      
      # Try login with new password
      post '/api/v1/auth/login', params: { email: user.email, password: 'newpassword123' }
      expect(response).to have_http_status(:success)
    end

    it 'rejects invalid token' do
      post '/api/v1/auth/reset_password', params: { token: 'invalid_token', password: 'newpassword123' }
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
