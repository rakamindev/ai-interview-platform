# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Cookie-based auth (P1-11)', type: :request do
  let(:org) { create(:organization) }

  it 'sets an HttpOnly auth_token cookie on login' do
    create(:user, organization: org, email: 'cookie-admin@example.com', password: 'password123', role: 'admin')

    post '/api/v1/auth/login', params: { email: 'cookie-admin@example.com', password: 'password123' }

    expect(response).to have_http_status(:ok)
    set_cookie = Array(response.headers['Set-Cookie']).join("\n")
    expect(set_cookie).to match(/auth_token=/)
    expect(set_cookie.downcase).to include('httponly')
  end

  it 'authenticates a request from the cookie with no Authorization header' do
    user = create(:user, organization: org, role: 'admin')
    token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: org.scheme)
    create(:assessment, tenant_id: org.id, name: 'Cookie Assessment')

    cookies['auth_token'] = token
    get '/api/v1/assessments'

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('Cookie Assessment')
  end

  it 'clears the auth_token cookie on logout' do
    post '/api/v1/auth/logout'

    expect(response).to have_http_status(:ok)
    set_cookie = Array(response.headers['Set-Cookie']).join("\n")
    expect(set_cookie).to match(/auth_token=;/)
  end
end
