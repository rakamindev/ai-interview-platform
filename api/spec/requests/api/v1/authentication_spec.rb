# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Authentication', type: :request do
  describe 'POST /api/v1/auth/login' do
    let(:password) { 'correct-horse-battery-staple' }
    let(:own_org)    { create(:organization) }
    let(:victim_org) { create(:organization) }
    let(:user)       { create(:user, password:, organization: own_org) }

    def decoded_scheme(response)
      token = JSON.parse(response.body)['token']
      JsonWebToken.decode(token)['scheme']
    end

    context 'without any X-Tenant-Scheme header' do
      it "issues a token scoped to the user's own organization" do
        post '/api/v1/auth/login', params: { email: user.email, password: }

        expect(response).to have_http_status(:ok)
        expect(decoded_scheme(response)).to eq(own_org.scheme)
      end
    end

    # Regression test for P0-1: tenant resolution must never be taken from a
    # client-supplied header. Before the fix, sending X-Tenant-Scheme with a
    # victim org's scheme caused the issued (validly signed) token to carry
    # that victim org's scheme instead of the authenticated user's real org.
    context 'when a client sends X-Tenant-Scheme for a different organization' do
      it "still issues a token scoped to the user's own organization, ignoring the header" do
        post '/api/v1/auth/login',
             params: { email: user.email, password: },
             headers: { 'X-Tenant-Scheme' => victim_org.scheme }

        expect(response).to have_http_status(:ok)
        expect(decoded_scheme(response)).to eq(own_org.scheme)
        expect(decoded_scheme(response)).not_to eq(victim_org.scheme)
      end
    end

    context 'with an invalid password' do
      it 'returns 401 and does not leak whether the email exists' do
        post '/api/v1/auth/login', params: { email: user.email, password: 'wrong' }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when the user is not an admin' do
      let(:user) { create(:user, :non_admin, password:, organization: own_org) }

      it 'returns 401' do
        post '/api/v1/auth/login', params: { email: user.email, password: }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end