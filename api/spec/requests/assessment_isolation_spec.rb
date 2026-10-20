# frozen_string_literal: true

require 'spec_helper'

# Smoke spec for the request harness: real middleware, real tenant scoping,
# real auth. If this fails, no isolation spec below it can be trusted.
RSpec.describe 'Assessment list isolation', type: :request do
  let!(:our_tenant)   { create_tenant(scheme: 'smoke-a') }
  let!(:other_tenant) { create_tenant(scheme: 'smoke-b') }

  before do
    create_assessment(our_tenant, name: 'Ours')
    create_assessment(other_tenant, name: 'Theirs')
  end

  it 'returns only the current tenant assessments' do
    get '/api/v1/assessments', headers: auth_headers(scheme: our_tenant.scheme)

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['assessments'].map { |a| a['name'] }).to eq(['Ours'])
  end

  it 'rejects requests with no resolvable tenant' do
    get '/api/v1/assessments'

    expect(response).to have_http_status(:forbidden)
    expect(response.parsed_body['errors'].first['message']).to include('Tenant not found')
  end

  it 'rejects a request with a tenant but no token' do
    get '/api/v1/assessments', headers: { 'X-Tenant-Scheme' => our_tenant.scheme }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'rejects a token whose scheme resolves to no tenant' do
    get '/api/v1/assessments', headers: auth_headers(scheme: 'unknown-tenant')

    expect(response).to have_http_status(:forbidden)
    expect(response.parsed_body['errors'].first['message']).to include('Tenant not found')
  end

  it 'rejects a role without assessor access' do
    get '/api/v1/assessments', headers: auth_headers(scheme: our_tenant.scheme, role: 'candidate')

    expect(response).to have_http_status(:forbidden)
  end
end
