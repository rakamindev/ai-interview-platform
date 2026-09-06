# frozen_string_literal: true

require 'rails_helper'

# Tenant isolation for portfolio records.
#
# `TenantScoped` is included by Assessment, Session and Vacancy, and applies a
# default_scope on Current.tenant_id. Portfolio, PortfolioSkill,
# AssessorOverride, TranscriptTurn, CoverageMap and FitGapReport include none of
# it and carry no tenant_id column, so their isolation depends entirely on each
# controller remembering to reach them through a scoped parent.
#
# These examples exercise that boundary through the real middleware stack — the
# tenant is resolved from the JWT `scheme` claim exactly as it is in production.
# The records under test belong to one organisation; every request is made with
# a valid, correctly signed token belonging to a *different* organisation.
#
# What is at stake is not abstract. A portfolio holds a named candidate's
# competency judgements and verbatim quotes from their interview, and an override
# changes the level a hiring decision is made on. Under UU PDP that is personal
# data and an automated evaluation of a data subject.
RSpec.describe 'Tenant isolation for portfolio records', type: :request do
  let!(:tenant_a) { create(:organization, scheme: 'tenant-a', identifier: 'tenant-a', host: 'a.example.test') }
  let!(:tenant_b) { create(:organization, scheme: 'tenant-b', identifier: 'tenant-b', host: 'b.example.test') }

  # Everything below belongs to tenant A.
  let(:assessment)     { create(:assessment, tenant_id: tenant_a.id) }
  let(:session)        { create(:session, tenant_id: tenant_a.id, assessment: assessment, candidate_name: 'Ahmad Rizky') }
  let(:portfolio)      { create(:portfolio, session: session) }
  let!(:skill)         { create(:portfolio_skill, portfolio: portfolio, ai_level: 2) }

  # A valid, correctly signed admin token — for tenant B.
  def headers_for(organization)
    token = JsonWebToken.encode(user_id: 99, role: 'admin', scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}", 'CONTENT_TYPE' => 'application/json' }
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    let(:params) { { override: { override_level: 5, assessor_notes: 'written by the wrong organisation' } }.to_json }

    it 'refuses an override from another tenant' do
      post "/api/v1/portfolio_skills/#{skill.id}/override", params: params, headers: headers_for(tenant_b)

      expect(response).to have_http_status(:not_found),
                          "an assessor in tenant B changed a candidate rating owned by tenant A " \
                          "(got #{response.status})"
    end

    it 'does not persist an override written by another tenant' do
      post "/api/v1/portfolio_skills/#{skill.id}/override", params: params, headers: headers_for(tenant_b)

      expect(skill.reload.assessor_override).to be_nil
    end

    it 'still allows the owning tenant to override' do
      post "/api/v1/portfolio_skills/#{skill.id}/override", params: params, headers: headers_for(tenant_a)

      expect(response).to have_http_status(:success)
      expect(skill.reload.assessor_override&.override_level).to eq(5)
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'refuses a JSON export to another tenant' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: headers_for(tenant_b)

      expect(response).to have_http_status(:not_found),
                          "tenant B exported a portfolio owned by tenant A (got #{response.status})"
    end

    it 'does not leak the candidate name or evidence quotes to another tenant' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: headers_for(tenant_b)

      expect(response.body).not_to include('Ahmad Rizky')
      expect(response.body).not_to include('read-only and a write provider')
    end

    it 'still allows the owning tenant to export' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: headers_for(tenant_a)

      expect(response).to have_http_status(:success)
    end
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    # Session includes TenantScoped, so this path is expected to be protected
    # already. Asserting it pins the difference between records that are scoped
    # at the data layer and records that rely on controller discipline.
    it 'refuses to serve a portfolio through another tenant\'s session lookup' do
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers_for(tenant_b)

      expect(response).to have_http_status(:not_found)
    end
  end
end
