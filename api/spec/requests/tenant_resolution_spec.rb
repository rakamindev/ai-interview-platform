# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tenant resolution (TenantResolverMiddleware)', type: :request do
  let(:org_a) { create(:organization, scheme: 'acme') }
  let(:org_b) { create(:organization, scheme: 'victim') }

  before do
    create(:assessment, tenant_id: org_a.id, name: 'Acme Assessment')
    create(:assessment, tenant_id: org_b.id, name: 'Victim Assessment')
  end

  def token_for(scheme, role: 'admin', user_id: 1)
    JsonWebToken.encode(user_id: user_id, role: role, scheme: scheme)
  end

  it 'scopes data to the tenant named in the verified JWT' do
    get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{token_for('acme')}" }

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('Acme Assessment')
    expect(response.body).not_to include('Victim Assessment')
  end

  it 'ignores a spoofed X-Tenant-Scheme header (P1-2)' do
    get '/api/v1/assessments',
        headers: {
          'Authorization'   => "Bearer #{token_for('acme')}",
          'X-Tenant-Scheme' => 'victim'
        }

    expect(response).to have_http_status(:ok)
    expect(response.body).to include('Acme Assessment')
    expect(response.body).not_to include('Victim Assessment')
  end

  it 'resolves no tenant for a forged (wrong-secret) token' do
    forged = JWT.encode({ user_id: 1, role: 'admin', scheme: 'victim' }, 'wrong-secret', 'HS256')

    get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{forged}" }

    expect(response).not_to have_http_status(:ok)
    expect(response.body).not_to include('Victim Assessment')
  end

  it 'rejects a request with no token' do
    get '/api/v1/assessments'

    expect(response).not_to have_http_status(:ok)
  end
end
