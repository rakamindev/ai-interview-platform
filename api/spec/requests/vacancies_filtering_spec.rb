# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Vacancies list filtering', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let(:token) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' }) }
  let(:auth) { { 'Authorization' => "Bearer #{token}" } }

  let!(:frontend) { create(:vacancy, tenant_id: org.id, role_title: 'Senior Frontend Engineer') }
  let!(:backend)  { create(:vacancy, tenant_id: org.id, role_title: 'Backend Engineer') }

  it 'searches by role title (case-insensitive)' do
    get '/api/v1/vacancies', params: { q: 'frontend' }, headers: auth

    titles = JSON.parse(response.body)['vacancies'].map { |v| v['role_title'] }
    expect(titles).to eq(['Senior Frontend Engineer'])
  end

  it 'sorts by name ascending' do
    get '/api/v1/vacancies', params: { sort: 'name' }, headers: auth

    titles = JSON.parse(response.body)['vacancies'].map { |v| v['role_title'] }
    expect(titles).to eq(['Backend Engineer', 'Senior Frontend Engineer'])
  end

  it 'returns pagination meta' do
    get '/api/v1/vacancies', params: { per_page: 1, page: 2 }, headers: auth

    body = JSON.parse(response.body)
    expect(body['vacancies'].length).to eq(1)
    expect(body['meta']['total_count']).to eq(2)
    expect(body['meta']['current_page']).to eq(2)
  end
end
