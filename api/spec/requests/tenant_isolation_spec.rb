# frozen_string_literal: true

require 'rails_helper'
require 'sidekiq/testing'

# Portfolios, portfolio skills and fit-gap reports have no tenant_id of their own: they belong to
# the organization of their interview session. An assessor must only reach records of the
# organization in their token, and another organization's records must answer 404, as if they
# did not exist.
RSpec.describe 'Tenant isolation for portfolios and fit-gap reports', type: :request do
  let!(:org_a) { Organization.create!(name: 'Org A', scheme: 'isolation-a', identifier: 'isolation-a', host: 'a.test') }
  let!(:org_b) { Organization.create!(name: 'Org B', scheme: 'isolation-b', identifier: 'isolation-b', host: 'b.test') }

  let!(:assessment) do
    Assessment.create!(tenant_id: org_a.id, created_by: 1, name: 'Backend Engineer', time_limit_min: 30)
  end
  let!(:interview_session) { Session.create!(tenant_id: org_a.id, assessment: assessment) }
  let!(:portfolio) do
    interview_session.create_portfolio!(generation_status: 'complete', generated_at: Time.current)
  end
  let!(:skill) do
    portfolio.portfolio_skills.create!(
      skill_label: 'Ruby', ai_level: 3, ai_confidence: 'high',
      evidence: ['I maintain a Rails monolith.'], competency_summary: 'Writes idiomatic Ruby.'
    )
  end
  let!(:vacancy_a) { Vacancy.create!(tenant_id: org_a.id, created_by: 1, role_title: 'Backend Engineer') }
  let!(:vacancy_b) { Vacancy.create!(tenant_id: org_b.id, created_by: 1, role_title: 'Platform Engineer') }
  let!(:report) { FitGapReport.create!(portfolio: portfolio, vacancy: vacancy_a, skill_comparisons: [comparison]) }

  let(:comparison) { { skill_label: 'Ruby', expected_level: 3, candidate_level: 3, result: 'match', delta: 0 } }

  def headers_for(organization)
    token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end

  before { Sidekiq::Worker.clear_all }

  describe 'an assessor of another organization' do
    let(:headers) { headers_for(org_b) }

    it 'cannot export the portfolio' do
      get "/api/v1/portfolios/#{portfolio.id}/export", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'cannot read its fit-gap report' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy_a.id}", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'cannot start a fit-gap report against a vacancy of its own' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy_b.id }, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'cannot regenerate a fit-gap report against a vacancy of its own' do
      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy_b.id }, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'cannot override a skill level, and the existing report stays' do
      post "/api/v1/portfolio_skills/#{skill.id}/override", params: { override: { override_level: 5 } }, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(skill.reload.assessor_override).to be_nil
      expect(FitGapReport.exists?(report.id)).to be(true)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end

  describe 'an assessor of the same organization' do
    let(:headers) { headers_for(org_a) }

    it 'exports the portfolio and reads its report' do
      get "/api/v1/portfolios/#{portfolio.id}/export", headers: headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig('portfolio', 'id')).to eq(portfolio.id)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy_a.id}", headers: headers

      expect(response).to have_http_status(:ok)
    end

    it 'overrides a skill level, which queues a fresh report' do
      post "/api/v1/portfolio_skills/#{skill.id}/override", params: { override: { override_level: 4 } }, headers: headers

      expect(response).to have_http_status(:created)
      expect(skill.reload.assessor_override.override_level).to eq(4)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    # Such a report can only exist if it was created through the old, unscoped endpoints.
    it "does not see a report built against another organization's vacancy" do
      FitGapReport.create!(portfolio: portfolio, vacancy: vacancy_b, skill_comparisons: [comparison])

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy_b.id}", headers: headers

      expect(response).to have_http_status(:not_found)

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { vacancy_id: vacancy_b.id }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['fit_gap_report']).to be_nil
    end
  end
end
