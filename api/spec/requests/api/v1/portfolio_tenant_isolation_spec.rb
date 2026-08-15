# frozen_string_literal: true

require 'rails_helper'

# The portfolio tree — Portfolio, PortfolioSkill, FitGapReport — carries no
# tenant_id of its own, so TenantScoped never applied to it and every controller
# lookup was global. An authenticated assessor in one tenant could read another
# tenant's candidate evidence quotes, export them as a PDF, and write an
# override onto them.
#
# The people whose data leaks here never chose this product and cannot opt out
# of it. Under UU PDP that makes this unlawful processing and a failure of the
# controller's security obligation, not merely a bug.
#
# Every example is paired: the foreign tenant is refused AND the owning tenant
# still succeeds. Without the second half, scoping everything to `none` would
# make this file pass while breaking the product.
RSpec.describe 'Portfolio tenant isolation', type: :request do
  let!(:tenant)       { create(:organization, scheme: 'test-corp',  identifier: 'test-corp') }
  let!(:other_tenant) { create(:organization, scheme: 'other-corp', identifier: 'other-corp') }

  let!(:foreign_portfolio) do
    with_tenant(other_tenant) { create(:portfolio, :with_skills, skill_count: 2) }
  end
  let!(:foreign_skill)   { foreign_portfolio.portfolio_skills.first }
  let!(:foreign_vacancy) { with_tenant(other_tenant) { create(:vacancy, :with_skills) } }

  let(:intruder) { auth_headers(tenant) }
  let(:owner)    { auth_headers(other_tenant) }

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'refuses to disclose another tenant\'s portfolio' do
      get "/api/v1/portfolios/#{foreign_portfolio.id}/export", params: { format: 'json' }, headers: intruder

      expect(response).to have_http_status(:not_found)
    end

    it 'answers 404 rather than 403, so the response does not confirm the record exists' do
      get "/api/v1/portfolios/#{foreign_portfolio.id}/export", params: { format: 'json' }, headers: intruder

      expect(response).not_to have_http_status(:forbidden)
    end

    it 'leaks no evidence quotes in the refusal body' do
      quote = foreign_skill.evidence_quotes.first
      get "/api/v1/portfolios/#{foreign_portfolio.id}/export", params: { format: 'json' }, headers: intruder

      expect(response.body).not_to include(quote) if quote.present?
      expect(response.body).not_to include(foreign_skill.competency_summary)
    end

    it 'still serves the portfolio to the tenant that owns it' do
      get "/api/v1/portfolios/#{foreign_portfolio.id}/export", params: { format: 'json' }, headers: owner

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'refuses to build a report against another tenant\'s portfolio' do
      post "/api/v1/portfolios/#{foreign_portfolio.id}/fitgap",
           params: { fitgap: { vacancy_id: foreign_vacancy.id } }.to_json, headers: intruder

      expect(response).to have_http_status(:not_found)
    end

    it 'enqueues no work on behalf of an intruder' do
      expect do
        post "/api/v1/portfolios/#{foreign_portfolio.id}/fitgap",
             params: { fitgap: { vacancy_id: foreign_vacancy.id } }.to_json, headers: intruder
      end.not_to change(FitGapGeneratorWorker.jobs, :size)
    end

    it 'still accepts the request from the owning tenant' do
      post "/api/v1/portfolios/#{foreign_portfolio.id}/fitgap",
           params: { fitgap: { vacancy_id: foreign_vacancy.id } }.to_json, headers: owner

      expect(response).to have_http_status(:accepted)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    let!(:foreign_report) do
      with_tenant(other_tenant) do
        create(:fit_gap_report, portfolio: foreign_portfolio, vacancy: foreign_vacancy)
      end
    end

    it 'refuses to disclose another tenant\'s report' do
      get "/api/v1/portfolios/#{foreign_portfolio.id}/fitgap/#{foreign_vacancy.id}", headers: intruder

      expect(response).to have_http_status(:not_found)
    end

    it 'still serves the report to the tenant that owns it' do
      get "/api/v1/portfolios/#{foreign_portfolio.id}/fitgap/#{foreign_vacancy.id}", headers: owner

      expect(response).to have_http_status(:ok)
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    let(:payload) { { override: { override_level: 5, assessor_notes: 'Rated from the design segment.' } }.to_json }

    it 'refuses to write an override onto another tenant\'s candidate' do
      post "/api/v1/portfolio_skills/#{foreign_skill.id}/override", params: payload, headers: intruder

      expect(response).to have_http_status(:not_found)
    end

    it 'persists nothing when refused' do
      expect do
        post "/api/v1/portfolio_skills/#{foreign_skill.id}/override", params: payload, headers: intruder
      end.not_to change(AssessorOverride, :count)
    end

    it 'does not alter an existing override belonging to another tenant' do
      existing = with_tenant(other_tenant) do
        create(:assessor_override, portfolio_skill: foreign_skill, override_level: 2)
      end

      post "/api/v1/portfolio_skills/#{foreign_skill.id}/override", params: payload, headers: intruder

      expect(existing.reload.override_level).to eq(2)
    end

    it 'still allows the owning tenant to override' do
      post "/api/v1/portfolio_skills/#{foreign_skill.id}/override", params: payload, headers: owner

      expect(response).to have_http_status(:created)
      expect(foreign_skill.reload.assessor_override.override_level).to eq(5)
    end
  end

  describe 'the scope itself' do
    it 'fails closed when there is no tenant in context' do
      clear_tenant

      expect(Portfolio.for_current_tenant).to be_empty
      expect(PortfolioSkill.for_current_tenant).to be_empty
    end
  end
end
