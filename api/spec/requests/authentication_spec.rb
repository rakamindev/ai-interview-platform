# frozen_string_literal: true

require 'rails_helper'

# The login endpoint is the real gate now that VITE_DEV_TOKEN is gone: it must
# accept both admin and assessor roles (only admin worked before), reject bad
# credentials, and return the user + organization so the frontend can render
# the real tenant.
RSpec.describe 'Authentication', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let(:password) { SecureRandom.alphanumeric(12) }

  it 'logs in an admin and returns token, user and organization' do
    create(:user, email: 'admin@test-corp.dev', password: password, role: 'admin')

    post '/api/v1/auth/login', params: { email: 'admin@test-corp.dev', password: password }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['token']).to be_present
    expect(body['user']['role']).to eq('admin')
    expect(body['organization']['scheme']).to eq('test-corp')
  end

  it 'logs in an assessor' do
    create(:user, email: 'assessor@test-corp.dev', password: password, role: 'assessor')

    post '/api/v1/auth/login', params: { email: 'assessor@test-corp.dev', password: password }

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig('user', 'role')).to eq('assessor')
  end

  it 'rejects a wrong password' do
    create(:user, email: 'admin@test-corp.dev', password: password, role: 'admin')

    post '/api/v1/auth/login', params: { email: 'admin@test-corp.dev', password: "wrong-#{password}" }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'rejects an unknown email' do
    post '/api/v1/auth/login', params: { email: 'nobody@test-corp.dev', password: password }

    expect(response).to have_http_status(:unauthorized)
  end
end
