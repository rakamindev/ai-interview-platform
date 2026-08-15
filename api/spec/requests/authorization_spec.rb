# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API authorization (AuthorizeApiRequest)', type: :request do
  let!(:org) { create(:organization, scheme: 'acme') }

  it 'accepts a token for an active user' do
    user  = create(:user, organization: org, role: 'admin')
    token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: 'acme')

    get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{token}" }

    expect(response).to have_http_status(:ok)
  end

  it 'rejects a token for a user that no longer exists (P1-7)' do
    token = JsonWebToken.encode(user_id: 999_999, role: 'admin', scheme: 'acme')

    get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{token}" }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'rejects a token for a deactivated user — revocation (P1-7)' do
    user  = create(:user, organization: org, role: 'admin', active: false)
    token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: 'acme')

    get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{token}" }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'rejects a token missing the issuer/audience claims (P1-14)' do
    secret  = ENV.fetch('SECRET_KEY_BASE')
    payload = { user_id: 1, role: 'admin', scheme: 'acme', exp: Time.now.to_i + 3600 }
    no_claims = JWT.encode(payload, secret, 'HS256')

    get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{no_claims}" }

    expect(response).not_to have_http_status(:ok)
  end
end
