# frozen_string_literal: true

require 'rails_helper'

# AC5: a portfolio, its skills, overrides and fit/gap reports are only reachable by the tenant
# that owns the interview session. Ids are sequential integers, so "guessing" one is trivial.
RSpec.describe 'Portfolio tenant isolation', type: :request do
  let(:org_a) { create(:organization) }
  let(:org_b) { create(:organization) }
  let(:headers_a) { auth_headers_for(org_a) }

  let(:portfolio_a) { create(:portfolio, organization: org_a) }
  let!(:skill_a) { create(:portfolio_skill, portfolio: portfolio_a) }
  let(:vacancy_a) { create(:vacancy, organization: org_a) }

  let(:portfolio_b) { create(:portfolio, organization: org_b) }
  let!(:skill_b) { create(:portfolio_skill, portfolio: portfolio_b, ai_level: 3) }
  let(:vacancy_b) { create(:vacancy, organization: org_b) }
  let!(:report_b) { create(:fit_gap_report, portfolio: portfolio_b, vacancy: vacancy_b) }

  def json
    JSON.parse(response.body)
  end

  context "with tenant A's token and tenant B's ids" do
    it 'does not export the portfolio as JSON' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export", params: { format: 'json' }, headers: headers_a

      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include(skill_b.competency_summary)
    end

    it 'does not export the portfolio as PDF' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export", params: { format: 'pdf' }, headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it 'does not start a fit/gap run, even against its own vacancy' do
      post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
           params: { fitgap: { vacancy_id: vacancy_a.id } }, headers: headers_a, as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'does not show an existing fit/gap report' do
      get "/api/v1/portfolios/#{portfolio_b.id}/fitgap/#{vacancy_b.id}", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it 'does not regenerate (and so delete) a fit/gap report' do
      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_b.id }, headers: headers_a, as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapReport.exists?(report_b.id)).to be(true)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'does not regenerate a fit/gap report against its own vacancy either' do
      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy_a.id }, headers: headers_a, as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'does not override a skill rating' do
      post "/api/v1/portfolio_skills/#{skill_b.id}/override",
           params: { override: { override_level: 5, assessor_notes: 'cross-tenant write' } },
           headers: headers_a, as: :json

      expect(response).to have_http_status(:not_found)
      expect(skill_b.reload.assessor_override).to be_nil
    end
  end

  context "with tenant A's token and tenant A's ids" do
    it 'exports the portfolio as JSON' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export", params: { format: 'json' }, headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(json.dig('portfolio', 'id')).to eq(portfolio_a.id)
    end

    it 'starts a fit/gap run against its own vacancy' do
      post "/api/v1/portfolios/#{portfolio_a.id}/fitgap",
           params: { fitgap: { vacancy_id: vacancy_a.id } }, headers: headers_a, as: :json

      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker.jobs.map { |j| j['args'].first(2) }).to eq([[portfolio_a.id, vacancy_a.id]])
    end

    it 'overrides a skill rating' do
      post "/api/v1/portfolio_skills/#{skill_a.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Saw stronger evidence in the follow-up.' } },
           headers: headers_a, as: :json

      expect(response).to have_http_status(:created)
      expect(skill_a.reload.assessor_override.override_level).to eq(4)
    end
  end
end
