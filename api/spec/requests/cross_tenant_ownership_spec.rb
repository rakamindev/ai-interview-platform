# frozen_string_literal: true

require 'rails_helper'

# TenantScoped covers Assessment, Session and Vacancy, so a bare find on any of
# those stops at the organization boundary. Portfolio and PortfolioSkill carry
# no tenant_id of their own — theirs is their session's — so nothing scopes a
# bare find on either, and an assessor in one organization could export,
# regenerate or overwrite another's candidates by sequential id.
#
# Written from the outside, through the routes an assessor actually calls, so
# the specs fail against the unfixed code and hold afterwards.
RSpec.describe 'Cross-tenant ownership', type: :request do
  include TenantHelpers

  let!(:home)     { create(:organization) }
  let!(:other)    { create(:organization) }
  let!(:assessor) { create(:user, role: 'admin') }

  let!(:foreign_session)   { create(:session, tenant_id: other.id) }
  let!(:foreign_portfolio) { create(:portfolio, :complete, session: foreign_session) }
  let!(:foreign_skill)     { create(:portfolio_skill, portfolio: foreign_portfolio) }

  let!(:home_vacancy) { create(:vacancy, tenant_id: home.id) }

  # Pairing a foreign portfolio with a vacancy the caller can see is exactly
  # the combination these endpoints accept, which is what makes the lookups
  # reachable rather than theoretical.
  let!(:foreign_report) do
    create(:fit_gap_report, portfolio: foreign_portfolio, vacancy: home_vacancy)
  end

  let(:headers) { auth_headers(assessor, home) }

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'does not hand one organization another organization candidate portfolio' do
      get "/api/v1/portfolios/#{foreign_portfolio.id}/export", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'still exports a portfolio the caller organization owns' do
      mine = create(:portfolio, :complete, session: create(:session, tenant_id: home.id))

      get "/api/v1/portfolios/#{mine.id}/export", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_response['portfolio']['id']).to eq(mine.id)
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'refuses to generate a fit/gap report against another organization portfolio' do
      post "/api/v1/portfolios/#{foreign_portfolio.id}/fitgap",
           params: { vacancy_id: home_vacancy.id }, headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'still queues a report for a portfolio the caller owns' do
      mine = create(:portfolio, :complete, session: create(:session, tenant_id: home.id))

      post "/api/v1/portfolios/#{mine.id}/fitgap",
           params: { vacancy_id: home_vacancy.id }, headers: headers

      expect(response).to have_http_status(:accepted)
    end
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    it 'leaves another organization report intact' do
      expect do
        post "/api/v1/portfolios/#{foreign_portfolio.id}/regenerate_fitgap",
             params: { vacancy_id: home_vacancy.id }, headers: headers
      end.not_to change { FitGapReport.count }

      expect(response).to have_http_status(:not_found)
      expect(FitGapReport.exists?(foreign_report.id)).to be true
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'does not expose another organization fit/gap report' do
      get "/api/v1/portfolios/#{foreign_portfolio.id}/fitgap/#{home_vacancy.id}",
          headers: headers

      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include(foreign_report.overall_narrative.to_s)
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'refuses to let one organization overwrite another organization skill level' do
      expect do
        post "/api/v1/portfolio_skills/#{foreign_skill.id}/override",
             params: { override: { override_level: 5, assessor_notes: 'Crossed a border.' } },
             headers: headers
      end.not_to change { AssessorOverride.count }

      expect(response).to have_http_status(:not_found)
    end

    it 'still overrides a skill the caller organization owns' do
      mine_skill = create(:portfolio_skill, portfolio: create(:portfolio, session: create(:session, tenant_id: home.id)))

      post "/api/v1/portfolio_skills/#{mine_skill.id}/override",
           params: { override: { override_level: 5, assessor_notes: 'Own tenant.' } },
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_response.dig('override', 'override_level')).to eq(5)
    end
  end
end
