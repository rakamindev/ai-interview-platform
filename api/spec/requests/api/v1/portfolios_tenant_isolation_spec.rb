# frozen_string_literal: true

require 'rails_helper'

# Regression coverage for F-01 (codebase-audit.md:363): Portfolio, FitGapReport and
# their session/vacancy relations have no tenant_id column of their own, so before the
# fix in portfolios_controller.rb, every action here did a plain `Portfolio.find(params[:id])`
# — any authenticated assessor from ANY tenant could read or mutate ANY other tenant's
# portfolio just by guessing/incrementing the id.
#
# Fix under test: `tenant_scoped_portfolios` (portfolios_controller.rb) joins through
# session (which IS tenant-scoped via the TenantScoped concern) before `.find`.
#
# Pre-fix failure condition established by an actual seeded-fault run (STEP 10, see
# EXPLORATION_LOG.md): `git stash` was used to temporarily revert
# portfolios_controller.rb to its pre-fix HEAD content, this spec was run against that
# reverted code, and restored afterwards. Each "denies" example below DID fail red
# against the pre-fix code (proving it exercises the vulnerability, not a tautology) —
# though not uniformly as a clean 200-with-leaked-data as originally assumed in the
# manual verification notes. The actual pre-fix failure mode per endpoint:
#   - export:            500 (Session's own TenantScoped default_scope made the
#                         `portfolio.session` association return nil for the wrong
#                         tenant, crashing `export_filename` on a nil `.candidate_name`
#                         instead of cleanly 404ing — still broken, just not a silent
#                         leak on this one route)
#   - fitgap/regenerate:  202 Accepted, job actually enqueued against the victim's
#                         portfolio (confirmed via `FitGapGeneratorWorker.jobs`) — a
#                         genuine cross-tenant write, once the request uses the
#                         attacker's OWN vacancy_id (see note on `attacker_vacancy`
#                         below — an attacker-owned vacancy_id is required to reach the
#                         vulnerable code path at all, since Vacancy is independently
#                         tenant-scoped and would otherwise 404 first on a victim-owned
#                         vacancy_id, masking the portfolio-level hole)
#   - fitgap retrieval:   200 with the victim's fit/gap report body returned in full —
#                         this is the one clean data leak in the set
#   - portfolio_skills#override (separate spec): 201, override actually written to the
#                         victim's data — see portfolio_skills_tenant_isolation_spec.rb
RSpec.describe 'Api::V1::Portfolios tenant isolation (F-01)', type: :request do
  let(:own_org)   { create(:organization) }
  let(:other_org) { create(:organization) }

  let(:own_session) { create(:session, organization: own_org) }
  let(:portfolio)   { create(:portfolio, session: own_session) }
  let!(:skill)      { create(:portfolio_skill, portfolio: portfolio) }
  let(:vacancy)     { create(:vacancy, organization: own_org) }
  let!(:fit_gap_report) { create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy) }

  let(:own_headers)   { auth_headers(organization: own_org) }
  let(:other_headers) { auth_headers(organization: other_org) }

  describe 'GET /api/v1/sessions/:id/portfolio (show)' do
    it "allows a tenant to view its own session's portfolio" do
      get "/api/v1/sessions/#{own_session.id}/portfolio", headers: own_headers

      expect(response).to have_http_status(:ok)
      expect(json.dig('portfolio', 'id')).to eq(portfolio.id)
    end

    it 'denies another tenant access to the session (and its portfolio)' do
      get "/api/v1/sessions/#{own_session.id}/portfolio", headers: other_headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'allows a tenant to export its own portfolio' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: own_headers

      expect(response).to have_http_status(:ok)
    end

    it "denies another tenant from exporting a portfolio it doesn't own" do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: other_headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap (generation)' do
    it 'allows a tenant to request fit/gap generation for its own portfolio' do
      new_vacancy = create(:vacancy, organization: own_org)

      expect do
        post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: new_vacancy.id }, headers: own_headers
      end.to change(FitGapGeneratorWorker.jobs, :size).by(1)

      expect(response).to have_http_status(:accepted)
    end

    it "denies another tenant from triggering fit/gap generation on a portfolio it doesn't own" do
      # Vacancy is independently tenant-scoped (TenantScoped concern), so a
      # victim-owned vacancy_id would 404 before ever reaching the vulnerable
      # portfolio lookup. Using the attacker's OWN vacancy_id isolates the actual
      # F-01 hole: can they target someone else's portfolio_id at all?
      attacker_vacancy = create(:vacancy, organization: other_org)

      expect do
        post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: attacker_vacancy.id }, headers: other_headers
      end.not_to change(FitGapGeneratorWorker.jobs, :size)

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id (retrieval)' do
    it "allows a tenant to retrieve its own portfolio's fit/gap report" do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: own_headers

      expect(response).to have_http_status(:ok)
      expect(json.dig('report', 'id')).to eq(fit_gap_report.id)
    end

    it "denies another tenant from retrieving a fit/gap report on a portfolio it doesn't own" do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: other_headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    it 'allows a tenant to regenerate its own fit/gap report' do
      expect do
        post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id }, headers: own_headers
      end.to change(FitGapGeneratorWorker.jobs, :size).by(1)

      expect(response).to have_http_status(:accepted)
    end

    it "denies another tenant from regenerating a fit/gap report on a portfolio it doesn't own" do
      # Same reasoning as the fitgap-generation case above: use the attacker's own
      # vacancy_id so the request reaches the vulnerable portfolio lookup instead of
      # failing earlier on Vacancy's own tenant scope.
      attacker_vacancy = create(:vacancy, organization: other_org)

      expect do
        post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: attacker_vacancy.id }, headers: other_headers
      end.not_to change(FitGapGeneratorWorker.jobs, :size)

      expect(response).to have_http_status(:not_found)
    end
  end
end
