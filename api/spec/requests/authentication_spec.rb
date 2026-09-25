# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Authentication API', type: :request do
  describe 'POST /api/v1/auth/register' do
    it 'creates an organization and server-assigned admin without accepting a client role' do
      post '/api/v1/auth/register', params: {
        organization_name: 'Example Hiring',
        email: 'owner@example.com',
        password: 'password123',
        role: 'user'
      }

      expect(response).to have_http_status(:created)
      payload = JSON.parse(response.body)
      user = User.find_by!(email: 'owner@example.com')

      expect(user.role).to eq('admin')
      expect(user.organization.name).to eq('Example Hiring')
      expect(payload.dig('organization', 'scheme')).to eq(user.organization.scheme)
      expect(payload['token']).to be_present
    end

    it 'rejects a short password without creating partial organization data' do
      expect do
        post '/api/v1/auth/register', params: {
          organization_name: 'Should Roll Back', email: 'bad@example.com', password: 'short'
        }
      end.not_to change(Organization, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(User.find_by(email: 'bad@example.com')).to be_nil
    end
  end

  describe 'login tenant binding' do
    it 'issues the token for the user organization instead of trusting a spoofed tenant header' do
      org = Organization.create!(name: 'Bound Org', scheme: 'bound-org', identifier: 'bound-org', host: 'bound-org.local', alias_hosts: [], config: {})
      User.create!(email: 'bound@example.com', password: 'password123', password_confirmation: 'password123', role: 'admin', organization: org)

      post '/api/v1/auth/login',
           params: { email: 'bound@example.com', password: 'password123' },
           headers: { 'X-Tenant-Scheme' => 'spoofed-org' }

      expect(response).to have_http_status(:ok)
      claims = JsonWebToken.decode(JSON.parse(response.body)['token'])
      expect(claims[:scheme]).to eq('bound-org')
    end
  end

  describe 'password recovery' do
    let!(:organization) do
      Organization.create!(name: 'Recovery Org', scheme: 'recovery-org', identifier: 'recovery-org', host: 'recovery-org.local', alias_hosts: [], config: {})
    end
    let!(:user) do
      User.create!(email: 'recover@example.com', password: 'password123', password_confirmation: 'password123', role: 'admin', organization: organization)
    end

    it 'uses the same generic message for known and unknown emails' do
      post '/api/v1/auth/forgot_password', params: { email: user.email }
      known_payload = JSON.parse(response.body)

      post '/api/v1/auth/forgot_password', params: { email: 'unknown@example.com' }
      unknown_payload = JSON.parse(response.body)

      expect(known_payload['message']).to eq(unknown_payload['message'])
      expect(known_payload['dev_reset_token']).to be_present
      expect(unknown_payload['dev_reset_token']).to be_nil
    end

    it 'resets the password with a valid token and invalidates that token after the password changes' do
      token = PasswordResetToken.generate(user)

      post '/api/v1/auth/reset_password', params: {
        token: token,
        password: 'newpassword123',
        password_confirmation: 'newpassword123'
      }

      expect(response).to have_http_status(:ok)
      expect(user.reload.authenticate('newpassword123')).to be_truthy

      post '/api/v1/auth/reset_password', params: {
        token: token, password: 'anotherpassword123', password_confirmation: 'anotherpassword123'
      }
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'rejects a tampered reset token' do
      post '/api/v1/auth/reset_password', params: {
        token: 'invalid-token', password: 'newpassword123', password_confirmation: 'newpassword123'
      }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
