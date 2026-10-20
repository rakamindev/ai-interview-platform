# frozen_string_literal: true

require 'spec_helper'

# P0: portfolio data belongs to a tenant through its session. These specs prove
# the boundary holds end to end — a second tenant must never reach another
# tenant's candidate results, read or write.
RSpec.describe 'Portfolio isolation', type: :request do
  let!(:owner_tenant) { create_tenant(scheme: 'iso-a') }
  let!(:other_tenant) { create_tenant(scheme: 'iso-b') }

  let!(:assessment) { create_assessment(owner_tenant, name: 'Frontend') }

  let!(:session) do
    Session.create!(assessment: assessment, tenant_id: owner_tenant.id)
  end

  let!(:portfolio) do
    Portfolio.create!(
      session:           session,
      generation_status: 'complete',
      generated_at:      Time.current
    )
  end

  let!(:skill) do
    portfolio.portfolio_skills.create!(
      skill_label:        'React',
      ai_level:           3,
      ai_confidence:      'high',
      competency_summary: 'Ships features independently.'
    )
  end

  let!(:owner_vacancy) do
    Vacancy.create!(tenant_id: owner_tenant.id, created_by: 1, role_title: 'Frontend Engineer', status: 'active')
  end

  let!(:other_vacancy) do
    Vacancy.create!(tenant_id: other_tenant.id, created_by: 1, role_title: 'Backend Engineer', status: 'active')
  end

  let(:owner_headers) { auth_headers(scheme: owner_tenant.scheme) }
  let(:other_headers) { auth_headers(scheme: other_tenant.scheme) }

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'serves the owner tenant' do
      get "/api/v1/portfolios/#{portfolio.id}/export",
          params: { format: 'json' }, headers: owner_headers

      expect(response).to have_http_status(:ok)
    end

    it 'hides another tenant portfolio' do
      get "/api/v1/portfolios/#{portfolio.id}/export",
          params: { format: 'json' }, headers: other_headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'refuses to write against another tenant skill' do
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params:  { override: { override_level: 5, assessor_notes: 'cross-tenant' } },
           headers: other_headers, as: :json

      expect(response).to have_http_status(:not_found)
      expect(skill.reload.assessor_override).to be_nil
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'refuses to start a report on another tenant portfolio' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params:  { fitgap: { vacancy_id: other_vacancy.id } },
           headers: other_headers, as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapReport.where(portfolio_id: portfolio.id)).to be_empty
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'hides an existing report from another tenant' do
      FitGapReport.create!(
        portfolio:          portfolio,
        vacancy:            owner_vacancy,
        skill_comparisons:  [{ 'skill_label' => 'React', 'result' => 'match' }],
        generated_at:       Time.current,
        vacancy_updated_at: owner_vacancy.updated_at
      )

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{owner_vacancy.id}",
          headers: other_headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
