# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  describe 'POST /api/v1/signup' do
    it 'ignores a client-supplied role and creates a least-privilege user' do
      post '/api/v1/signup', params: {
        email: 'newadmin@example.com',
        password: 'Password123!',
        role: 'admin',
      }

      expect(response).to have_http_status(:created)
      expect(User.find_by(email: 'newadmin@example.com')&.role).to eq('user')

      body = JSON.parse(response.body)
      expect(body.dig('user', 'role')).to eq('user')
      expect(JsonWebToken.decode(body['token'])[:role]).to eq('user')
    end

    it 'defaults to a user role when none is supplied' do
      post '/api/v1/signup', params: { email: 'plain@example.com', password: 'Password123!' }

      expect(response).to have_http_status(:created)
      expect(User.find_by(email: 'plain@example.com')&.role).to eq('user')
    end
  end

  describe 'POST /api/v1/auth/login' do
    let(:organization) { create(:organization, scheme: 'acme') }
    let(:admin) { create(:admin_user, organization_id: organization.id) }

    it 'derives the tenant scheme from the user organization and ignores any header' do
      post '/api/v1/auth/login',
           params: { email: admin.email, password: 'Password123!' },
           headers: { 'X-Tenant-Scheme' => 'evil-corp' }

      expect(response).to have_http_status(:ok)
      token = JSON.parse(response.body)['token']
      expect(JsonWebToken.decode(token)[:scheme]).to eq('acme')
    end

    it 'rejects login when the admin has no organization' do
      orgless = create(:admin_user, organization_id: nil)
      post '/api/v1/auth/login', params: { email: orgless.email, password: 'Password123!' }
      expect(response).to have_http_status(:forbidden)
    end
  end
end
