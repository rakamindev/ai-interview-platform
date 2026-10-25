# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  let!(:org_a) { create(:organization, scheme: 'tenant-a') }
  let!(:org_b) { create(:organization, scheme: 'tenant-b') }
  let!(:user_a) { create(:user, email: 'a@example.com', scheme: 'tenant-a') }

  def login(params = {}, headers = {})
    post '/api/v1/auth/login',
         params: { email: 'a@example.com', password: 'password123' }.merge(params),
         headers: headers
  end

  def token_scheme
    JsonWebToken.decode(JSON.parse(response.body)['token'])[:scheme]
  end

  describe 'POST /api/v1/auth/login' do
    it 'issues a token scoped to the user own tenant' do
      login
      expect(response).to have_http_status(:ok)
      expect(token_scheme).to eq('tenant-a')
    end

    it 'ignores a client-supplied scheme param (no cross-tenant token minting)' do
      login(scheme: 'tenant-b')
      expect(response).to have_http_status(:ok)
      expect(token_scheme).to eq('tenant-a')
    end

    it 'ignores a client-supplied X-Tenant-Scheme header' do
      login({}, { 'X-Tenant-Scheme' => 'tenant-b' })
      expect(response).to have_http_status(:ok)
      expect(token_scheme).to eq('tenant-a')
    end

    it 'fails closed when the user has no tenant assigned' do
      user_a.update_column(:scheme, nil)
      login
      expect(response).to have_http_status(:forbidden)
      expect(JSON.parse(response.body)).not_to have_key('token')
    end

    it 'fails closed when the user tenant does not exist' do
      user_a.update_column(:scheme, 'ghost-tenant')
      login
      expect(response).to have_http_status(:forbidden)
    end

    it 'rejects invalid credentials' do
      login(password: 'wrong')
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
