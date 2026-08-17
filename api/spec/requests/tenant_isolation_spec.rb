# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tenant isolation on portfolio reads', type: :request do
  let(:tenant_a) { create(:organization, name: 'Tenant A', scheme: 'tenant-a', identifier: 'a') }
  let(:tenant_b) { create(:organization, name: 'Tenant B', scheme: 'tenant-b', identifier: 'b') }

  let(:assessment_a) do
    create(:assessment, tenant_id: tenant_a.id, name: 'A')
  end
  let(:assessment_b) do
    create(:assessment, tenant_id: tenant_b.id, name: 'B')
  end

  let(:session_a) { create(:session, assessment: assessment_a, tenant_id: tenant_a.id) }
  let(:session_b) { create(:session, assessment: assessment_b, tenant_id: tenant_b.id) }

  let(:portfolio_a) { create(:portfolio, session: session_a) }
  let(:portfolio_b) { create(:portfolio, session: session_b) }

  let(:vacancy_a) { create(:vacancy, tenant_id: tenant_a.id, role_title: 'Vacancy A') }
  let(:vacancy_b) { create(:vacancy, tenant_id: tenant_b.id, role_title: 'Vacancy B') }

  def auth_headers(tenant, role: 'admin')
    token = JsonWebToken.encode(
      user_id: 1,
      role: role,
      scheme: tenant.scheme
    )
    { 'Authorization' => "Bearer #{token}" }
  end

  before do
    portfolio_a
    portfolio_b
  end

  context 'when an assessor from tenant A has a report on their own portfolio' do
    before do
      create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy_a)
    end

    it 'allows them to read their own tenant fit/gap report' do
      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}", headers: auth_headers(tenant_a)

      expect(response.status).to eq(200)
      body = JSON.parse(response.body)
      expect(body.dig('report', 'portfolio_id')).to eq(portfolio_a.id)
    end

    it 'denies tenant A reading tenant B portfolio report by id, even when that report exists' do
      create(:fit_gap_report, portfolio: portfolio_b, vacancy: vacancy_b)

      get "/api/v1/portfolios/#{portfolio_b.id}/fitgap/#{vacancy_b.id}", headers: auth_headers(tenant_a)

      expect(response.status).to eq(404)
      expect(response.body).to include('Portfolio not found')
    end

    it 'denies tenant A triggering fitgap on tenant B portfolio' do
      post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
           params: { vacancy_id: vacancy_a.id },
           headers: auth_headers(tenant_a)

      expect(response.status).to eq(404)
      expect(response.body).to include('Portfolio not found')
    end

    it 'denies tenant A regenerating fitgap on tenant B portfolio' do
      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_a.id },
           headers: auth_headers(tenant_a)

      expect(response.status).to eq(404)
      expect(response.body).to include('Portfolio not found')
    end
  end

  context 'evaluation summary exposure' do
    it 'exposes evaluation summary for a complete portfolio' do
      create(:portfolio_skill, portfolio: portfolio_a, evidence: ['Quote'])

      get "/api/v1/sessions/#{session_a.id}/portfolio", headers: auth_headers(tenant_a)

      expect(response.status).to eq(200)
      body = JSON.parse(response.body)
      expect(body.dig('portfolio', 'evaluation')).to include(
        'overall_status' => 'ready_for_review',
        'needs_review' => false
      )
    end
  end
end
