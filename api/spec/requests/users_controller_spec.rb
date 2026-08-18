# frozen_string_literal: true

require 'rails_helper'

# User management is admin-only (registration is invite-based, not public):
# an assessor must never be able to list or create accounts.
RSpec.describe 'Users API', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let(:password) { SecureRandom.alphanumeric(12) }
  let(:admin_token)    { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' }) }
  let(:assessor_token) { JsonWebToken.encode({ user_id: 2, role: 'assessor', scheme: 'test-corp' }) }

  def auth(token)
    { 'Authorization' => "Bearer #{token}" }
  end

  it 'admin can list users' do
    create(:user, email: 'a@test-corp.dev', role: 'admin')
    create(:user, email: 'b@test-corp.dev', role: 'assessor')

    get '/api/v1/users', headers: auth(admin_token)

    expect(response).to have_http_status(:ok)
    emails = JSON.parse(response.body)['users'].map { |u| u['email'] }
    expect(emails).to include('a@test-corp.dev', 'b@test-corp.dev')
  end

  it 'admin can create an assessor account' do
    post '/api/v1/users',
         params: { user: { email: 'new-assessor@test-corp.dev', password: password, role: 'assessor' } },
         headers: auth(admin_token)

    expect(response).to have_http_status(:created)
    expect(User.find_by(email: 'new-assessor@test-corp.dev').role).to eq('assessor')
  end

  it 'rejects a duplicate email (case-insensitive) with 422' do
    create(:user, email: 'dup@test-corp.dev', role: 'assessor')

    post '/api/v1/users',
         params: { user: { email: 'DUP@test-corp.dev', password: password, role: 'assessor' } },
         headers: auth(admin_token)

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'assessor cannot list users' do
    get '/api/v1/users', headers: auth(assessor_token)

    expect(response).to have_http_status(:forbidden)
  end

  it 'assessor cannot create users' do
    post '/api/v1/users',
         params: { user: { email: 'sneaky@test-corp.dev', password: password, role: 'admin' } },
         headers: auth(assessor_token)

    expect(response).to have_http_status(:forbidden)
    expect(User.find_by(email: 'sneaky@test-corp.dev')).to be_nil
  end
end
