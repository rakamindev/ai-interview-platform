# frozen_string_literal: true

require 'rails_helper'

# Request specs exercise the whole stack at once: routing, middleware, tenant
# resolution, JWT issuance, the database, and Rack::Attack. Getting these green
# is the proof that the harness itself is wired correctly.
RSpec.describe 'Authentication', type: :request do
  include TenantHelpers

  describe 'POST /api/v1/auth/login' do
    let(:password) { 'password123' }
    let!(:organization) { create(:organization) }

    before { in_tenant(organization) }

    context 'with correct credentials' do
      let!(:assessor) { create(:user, email: 'assessor@example.test', password: password) }

      it 'returns a token and the user' do
        post '/api/v1/auth/login', params: { email: assessor.email, password: password }

        expect(response).to have_http_status(:ok)
        expect(json_response).to include('token', 'user')
        expect(json_response['user']).to include('id' => assessor.id, 'role' => 'admin')
      end

      it 'issues a token that decodes back to the user' do
        post '/api/v1/auth/login', params: { email: assessor.email, password: password }

        claims = JsonWebToken.decode(json_response['token'])
        expect(claims[:user_id]).to eq(assessor.id)
        expect(claims[:role]).to eq('admin')
      end

      it 'accepts a differently cased email' do
        post '/api/v1/auth/login', params: { email: assessor.email.upcase, password: password }

        expect(response).to have_http_status(:ok)
      end
    end

    context 'with bad credentials' do
      let!(:assessor) { create(:user, email: 'assessor@example.test', password: password) }

      it 'rejects a wrong password' do
        post '/api/v1/auth/login', params: { email: assessor.email, password: 'wrong' }

        expect(response).to have_http_status(:unauthorized)
      end

      it 'rejects an unknown email' do
        post '/api/v1/auth/login', params: { email: 'nobody@example.test', password: password }

        expect(response).to have_http_status(:unauthorized)
      end

      it 'rejects blank input rather than raising' do
        post '/api/v1/auth/login', params: { email: '', password: '' }

        expect(response).to have_http_status(:unauthorized)
      end

      it 'does not reveal which half of the credential was wrong' do
        post '/api/v1/auth/login', params: { email: 'nobody@example.test', password: 'wrong' }

        expect(json_response['errors'].first['message']).to eq('Invalid email or password')
      end
    end

    context 'with a non-admin user' do
      let!(:member) { create(:user, :non_admin, email: 'member@example.test', password: password) }

      it 'refuses to mint an assessor token' do
        post '/api/v1/auth/login', params: { email: member.email, password: password }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end