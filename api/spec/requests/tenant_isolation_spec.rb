# frozen_string_literal: true

require 'rails_helper'

# B2/B3 from the repository investigation: portfolio and override endpoints looked records up by id
# without checking the tenant, so another company's valid token could read and change them.
# Expected: no token -> 401; another tenant's resource -> 404 (no hint that it exists); own -> success.
# Scope: these endpoints only. The local login endpoint that lets a caller choose its tenant (B1) is a
# separate, escalated trust-boundary issue and is not fixed or proven here.
RSpec.describe 'Tenant isolation on portfolio endpoints', type: :request do
  let(:acme)    { create_org(scheme: 'acme') }
  let(:globex)  { create_org(scheme: 'globex') }
  let(:session) { create_interviewed_session(org: acme, assessment: create_assessment(org: acme)) }
  let(:quote)   { 'I moved the feed into a store so components subscribe to just the slice they need.' }

  let(:portfolio) do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    stub_gemini(model_output(level: 3, quote: quote))
    run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))
    session.reload.portfolio
  end
  let(:skill)   { portfolio.portfolio_skills.first }
  let(:vacancy) do
    Vacancy.create!(tenant_id: globex.id, created_by: 1, role_title: 'Engineer',
                    vacancy_skills_attributes: [{ skill_label: 'React / Frontend Development Core', expected_level: 3 }])
  end
  let(:own_vacancy) do
    Vacancy.create!(tenant_id: acme.id, created_by: 1, role_title: 'Engineer',
                    vacancy_skills_attributes: [{ skill_label: 'React / Frontend Development Core', expected_level: 3 }])
  end

  let(:acme_headers)   { auth_headers(acme) }
  let(:globex_headers) { auth_headers(globex) }

  describe 'another tenant (globex) cannot reach acme data' do
    it 'cannot export the portfolio as JSON' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: globex_headers
      expect(response).to have_http_status(:not_found)
    end

    it 'cannot write an override on an acme candidate' do
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 1, assessor_notes: 'tenant B' } }, headers: globex_headers
      expect(response).to have_http_status(:not_found)
      expect(AssessorOverride.count).to eq(0)
    end

    it 'cannot start a fit/gap report on an acme portfolio' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: globex_headers
      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'cannot regenerate an acme fit/gap report' do
      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id }, headers: globex_headers
      expect(response).to have_http_status(:not_found)
    end

    it 'cannot read an acme fit/gap report' do
      FitGapReport.create!(portfolio: portfolio, vacancy: own_vacancy, skill_comparisons: [{ skill_label: 'x' }])
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{own_vacancy.id}", headers: globex_headers
      expect(response).to have_http_status(:not_found)
    end

    it 'cannot read or regenerate the acme portfolio through the session route' do
      get "/api/v1/sessions/#{session.id}/portfolio", headers: globex_headers
      expect(response).to have_http_status(:not_found)
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: globex_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "acme's own portfolio paired with another tenant's vacancy" do
    it 'rejects starting fit/gap and queues no job' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: acme_headers
      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'rejects regenerating fit/gap and queues no job' do
      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id }, headers: acme_headers
      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'does not return a report stored against another tenant\'s vacancy' do
      FitGapReport.create!(portfolio: portfolio, vacancy: vacancy, skill_comparisons: [{ skill_label: 'x' }])
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: acme_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  it "leaves another tenant's fit/gap report out of acme's JSON export" do
    FitGapReport.create!(portfolio: portfolio, vacancy: vacancy, skill_comparisons: [{ skill_label: 'x' }])
    get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json', vacancy_id: vacancy.id }, headers: acme_headers
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)['fit_gap_report']).to be_nil
  end

  describe 'without a token' do
    it 'is rejected as unauthenticated (401), not as a missing tenant' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }
      expect(response).to have_http_status(:unauthorized)
      post "/api/v1/portfolio_skills/#{skill.id}/override", params: { override: { override_level: 1 } }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'the owning tenant (acme) still works' do
    it 'can export, override and run fit/gap' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: acme_headers
      expect(response).to have_http_status(:ok)

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'own' } }, headers: acme_headers
      expect(response).to have_http_status(:created)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: own_vacancy.id }, headers: acme_headers
      expect(response).to have_http_status(:accepted)
    end
  end

  describe 'when no tenant context is set' do
    it 'fails closed instead of returning every tenant\'s portfolios' do
      portfolio
      RequestStore.clear!
      expect { Portfolio.visible_to_current_tenant.to_a }.to raise_error(RuntimeError, /Current.tenant_id/)
    end
  end
end
