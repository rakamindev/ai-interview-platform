# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Cross-tenant isolation', type: :request do
  before do
    # Ensure both orgs exist in the test DB before any tenant-scoped lets.
    org1_id = ActiveRecord::Base.connection.select_value(
      "SELECT id FROM public.organizations WHERE scheme = 'test-corp' LIMIT 1"
    )
    unless org1_id
      ActiveRecord::Base.connection.execute(<<~SQL)
        INSERT INTO public.organizations (name, scheme, identifier, host, alias_hosts, config, created_at, updated_at)
        VALUES ('Test Corp', 'test-corp', 'test-corp', 'localhost', '{}', '{}', NOW(), NOW())
      SQL
    end
    org2_id = ActiveRecord::Base.connection.select_value(
      "SELECT id FROM public.organizations WHERE scheme = 'test-corp-2' LIMIT 1"
    )
    unless org2_id
      ActiveRecord::Base.connection.execute(<<~SQL)
        INSERT INTO public.organizations (name, scheme, identifier, host, alias_hosts, config, created_at, updated_at)
        VALUES ('Test Corp 2', 'test-corp-2', 'test-corp-2', 'localhost2', '{}', '{}', NOW(), NOW())
      SQL
    end
  end

  let(:org1) { Organization.identify('test-corp') }
  let(:org2) { Organization.identify('test-corp-2') }

  let(:token1) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' }) }
  let(:token2) { JsonWebToken.encode({ user_id: 99, role: 'admin', scheme: 'test-corp-2' }) }

  let(:assessment) { create(:assessment, tenant_id: org1.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org1.id, status: 'ended') }
  let(:portfolio) { create(:portfolio, session: session, tenant_id: org1.id) }
  let!(:skill) { create(:portfolio_skill, portfolio: portfolio, ai_level: 3) }
  let!(:vacancy) { create(:vacancy, tenant_id: org1.id) }

  def auth_headers(token, scheme, host)
    {
      'Authorization' => "Bearer #{token}",
      'X-Tenant-Scheme' => scheme,
      'Host' => host
    }
  end

  it 'returns 404 for a cross-tenant portfolio export' do
    get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: auth_headers(token2, 'test-corp-2', 'localhost2')
    expect(response).to have_http_status(:not_found)
  end

  it 'returns 404 for a cross-tenant session portfolio' do
    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers(token2, 'test-corp-2', 'localhost2')
    expect(response).to have_http_status(:not_found)
  end

  it 'returns 404 for a cross-tenant review' do
    put "/api/v1/portfolio_skills/#{skill.id}/review",
        params: { review: { outcome: 'confirmed', rationale: 'x' } }.to_json,
        headers: auth_headers(token2, 'test-corp-2', 'localhost2').merge('Content-Type' => 'application/json')
    expect(response).to have_http_status(:not_found)
  end

  it 'allows same-tenant access' do
    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers(token1, 'test-corp', 'localhost')
    expect(response).to have_http_status(:ok)
  end
end
