# frozen_string_literal: true

require 'rails_helper'

# AC18: an assessor of one tenant must never read or write another tenant's
# candidate data. Responses are 404 so that existence is not leaked.
RSpec.describe 'Portfolio tenant isolation' do
  let(:tenant_a) { create(:organization, scheme: 'tenant-a') }
  let(:tenant_b) { create(:organization, scheme: 'tenant-b') }

  let(:portfolio_b) do
    create(:portfolio, session: create(:session, assessment: create(:assessment, organization: tenant_b)))
  end
  let!(:skill_b) { create(:portfolio_skill, portfolio: portfolio_b) }
  let(:vacancy_a) { create(:vacancy, organization: tenant_a) }
  let(:headers_a) { auth_headers(tenant_a) }

  it 'does not export another tenant\'s portfolio' do
    get "/api/v1/portfolios/#{portfolio_b.id}/export", params: { format: 'json' }, headers: headers_a

    expect(response).to have_http_status(:not_found)
    expect(response.body).not_to include(skill_b.evidence.first)
  end

  it 'does not generate a fit/gap report for another tenant\'s portfolio' do
    post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
         params: { vacancy_id: vacancy_a.id }.to_json, headers: headers_a

    expect(response).to have_http_status(:not_found)
    expect(FitGapGeneratorWorker.jobs).to be_empty
    expect(FitGapReport.count).to eq(0)
  end

  it 'does not regenerate a fit/gap report for another tenant\'s portfolio' do
    post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
         params: { vacancy_id: vacancy_a.id }.to_json, headers: headers_a

    expect(response).to have_http_status(:not_found)
    expect(FitGapGeneratorWorker.jobs).to be_empty
  end

  it 'does not show another tenant\'s fit/gap report' do
    create(:fit_gap_report, portfolio: portfolio_b, vacancy: create(:vacancy, organization: tenant_b))

    get "/api/v1/portfolios/#{portfolio_b.id}/fitgap/#{FitGapReport.last.vacancy_id}", headers: headers_a

    expect(response).to have_http_status(:not_found)
  end

  it 'does not let an assessor override another tenant\'s skill rating' do
    post "/api/v1/portfolio_skills/#{skill_b.id}/override",
         params: { override: { override_level: 5, assessor_notes: 'x' } }.to_json, headers: headers_a

    expect(response).to have_http_status(:not_found)
    expect(skill_b.reload.assessor_override).to be_nil
  end
end
