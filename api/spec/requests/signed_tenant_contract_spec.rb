# frozen_string_literal: true

require 'rails_helper'

# The token issuer decides which tenant the user may name. This checks the HTTP binding only;
# local login still allows an admin to choose the signed scheme (B1).
RSpec.describe 'Signed tenant contract for authenticated HTTP requests', type: :request do
  let!(:acme) { create_org(scheme: 'acme') }
  let!(:globex) { create_org(scheme: 'globex') }
  let!(:acme_assessment) { create_assessment(org: acme) }
  let!(:globex_assessment) { create_assessment(org: globex) }

  it 'allows an acme-signed token to read acme data' do
    get "/api/v1/assessments/#{acme_assessment.id}", headers: auth_headers(acme)

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig('assessment', 'id')).to eq(acme_assessment.id)
  end

  it 'rejects a signed token without scheme even when the header supplies a tenant' do
    token = JsonWebToken.encode(user_id: 1, role: 'admin')
    expect(Organization).not_to receive(:identify)
    get "/api/v1/assessments/#{acme_assessment.id}",
        headers: { 'Authorization' => "Bearer #{token}", 'X-Tenant-Scheme' => 'acme' }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'rejects a signed token without scheme even when Referer supplies a tenant' do
    token = JsonWebToken.encode(user_id: 1, role: 'admin')
    expect(Organization).not_to receive(:identify)
    get "/api/v1/assessments/#{acme_assessment.id}",
        headers: { 'Authorization' => "Bearer #{token}", 'Referer' => 'https://acme.test/interviews' }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'uses the signed acme tenant despite a conflicting globex header' do
    headers = auth_headers(acme).merge('X-Tenant-Scheme' => 'globex')
    get "/api/v1/assessments/#{acme_assessment.id}", headers: headers
    expect(response).to have_http_status(:ok)

    get "/api/v1/assessments/#{globex_assessment.id}", headers: headers
    expect(response).to have_http_status(:not_found)
  end

  it 'rejects a verified token if resolved organization does not match its signed tenant' do
    allow_any_instance_of(TenantResolverMiddleware).to receive(:resolve_scheme).and_return('globex')
    get "/api/v1/assessments/#{globex_assessment.id}", headers: auth_headers(acme)

    expect(response).to have_http_status(:unauthorized)
  end

  it 'leaves local login issuing the caller-selected scheme (the unresolved B1 boundary)' do
    User.create!(email: 'synthetic-admin@example.test', password: 'synthetic-test-password', role: 'admin')
    post '/api/v1/auth/login', headers: { 'X-Tenant-Scheme' => 'globex' },
                             params: { email: 'synthetic-admin@example.test', password: 'synthetic-test-password' }

    expect(response).to have_http_status(:ok)
    expect(JsonWebToken.decode(JSON.parse(response.body).fetch('token'))[:scheme]).to eq('globex')
  end
end
