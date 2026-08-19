# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios API cross-tenant isolation', type: :request do
  let!(:tenant_a) { create(:organization, scheme: 'tenant-a') }
  let!(:tenant_b) { create(:organization, scheme: 'tenant-b') }

  let!(:portfolio_a) do
    in_tenant(tenant_a) do
      assessment = create(:assessment)
      session = create(:session, assessment: assessment, status: 'ended')
      create(:portfolio, session: session, generation_status: 'complete', generated_at: Time.current)
    end
  end

  it 'returns 404 when a foreign tenant exports a portfolio' do
    headers = auth_header_for(scheme: 'tenant-b')

    get "/api/v1/portfolios/#{portfolio_a.id}/export", params: { format: 'json' }, headers: headers

    expect(response).to have_http_status(:not_found)
  end

  let!(:vacancy_a) do
    in_tenant(tenant_a) { create(:vacancy) }
  end

  it 'returns 404 when a foreign tenant fetches a fit/gap report' do
    headers = auth_header_for(scheme: 'tenant-b')

    post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
         params: { fitgap: { vacancy_id: vacancy_a.id } },
         headers: headers

    expect(response).to have_http_status(:not_found)
  end

  it 'allows the owning tenant to export its own portfolio' do
    headers = auth_header_for(scheme: 'tenant-a')

    get "/api/v1/portfolios/#{portfolio_a.id}/export", params: { format: 'json' }, headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['portfolio']['id']).to eq(portfolio_a.id)
  end
end