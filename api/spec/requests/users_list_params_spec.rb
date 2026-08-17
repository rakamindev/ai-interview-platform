# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'User management params', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let(:admin_token) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' }) }
  let(:auth) { { 'Authorization' => "Bearer #{admin_token}" } }

  let!(:alice) { create(:user, email: 'alice@test-corp.dev', role: 'admin') }
  let!(:bob)   { create(:user, email: 'bob@test-corp.dev', role: 'assessor') }

  it 'searches users by email (case-insensitive)' do
    get '/api/v1/users', params: { q: 'ALICE' }, headers: auth

    emails = JSON.parse(response.body)['users'].map { |u| u['email'] }
    expect(emails).to eq(['alice@test-corp.dev'])
  end

  it 'filters users by role' do
    get '/api/v1/users', params: { role: 'assessor' }, headers: auth

    roles = JSON.parse(response.body)['users'].map { |u| u['role'] }
    expect(roles).to eq(['assessor'])
  end

  it 'paginates with meta' do
    get '/api/v1/users', params: { per_page: 1, page: 2 }, headers: auth

    body = JSON.parse(response.body)
    expect(body['users'].length).to eq(1)
    expect(body['meta']['total_count']).to eq(2)
    expect(body['meta']['current_page']).to eq(2)
  end
end
