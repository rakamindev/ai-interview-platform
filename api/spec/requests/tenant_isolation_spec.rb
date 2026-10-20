# frozen_string_literal: true

require 'rails_helper'

# One organization must never see or change another organization's candidates.
RSpec.describe 'Tenant isolation', type: :request do
  let(:company_a) { create(:organization) }
  let(:company_b) { create(:organization) }

  let(:assessment) { create(:assessment, organization: company_a) }
  let(:session)    { create(:session, :ended, assessment:) }
  let(:portfolio)  { create(:portfolio, session:) }
  let!(:skill)     { create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 2) }
  let(:vacancy)    { create(:vacancy, organization: company_a) }

  let(:as_a) { auth_headers_for(company_a) }
  let(:as_b) { auth_headers_for(company_b, user_id: 99) }

  describe 'tenant-scoped resources' do
    it 'lets the owning organization read its assessment, session and portfolio' do
      get "/api/v1/assessments/#{assessment.id}", headers: as_a
      expect(response).to have_http_status(:ok)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: as_a
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('portfolio', 'skills', 0, 'skill_label')).to eq('React')
    end

    it "hides another organization's assessment, session, portfolio and vacancy" do
      get "/api/v1/assessments/#{assessment.id}", headers: as_b
      expect(response).to have_http_status(:not_found)

      get "/api/v1/sessions/#{session.id}", headers: as_b
      expect(response).to have_http_status(:not_found)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: as_b
      expect(response).to have_http_status(:not_found)

      get "/api/v1/vacancies/#{vacancy.id}", headers: as_b
      expect(response).to have_http_status(:not_found)
    end

    it "lists only the caller's assessments" do
      create(:assessment, organization: company_b, name: 'Company B role')
      assessment

      get '/api/v1/assessments', headers: as_b

      expect(response.parsed_body['assessments'].pluck('name')).to eq(['Company B role'])
    end
  end

  describe 'portfolio routes, for the owning organization' do
    # The scoping must not lock out the owner: each route still works for company A.
    it 'exports its own portfolio' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: as_a

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('portfolio', 'skills', 0, 'skill_label')).to eq('React')
    end

    it 'overrides a rating on its own portfolio' do
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Probed in round two' } }.to_json, headers: as_a

      expect(response).to have_http_status(:created)
      expect(skill.reload.assessor_override.override_level).to eq(4)
    end

    it 'reads, requests and regenerates fit/gap on its own portfolio' do
      create(:fit_gap_report, portfolio:, vacancy:)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: as_a
      expect(response).to have_http_status(:ok)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json, headers: as_a
      expect(response).to have_http_status(:ok)

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id }.to_json,
                                                                     headers: as_a
      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end
  end

  describe 'portfolio routes, for another organization (P0-2)' do
    # Company B uses its own vacancy, so the only thing that can stop it is the portfolio lookup.
    let(:vacancy_b) { create(:vacancy, organization: company_b) }

    it "does not export another organization's portfolio" do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: as_b

      expect(response).to have_http_status(:not_found)
    end

    it "does not let another organization override a rating" do
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 5, assessor_notes: 'cross-tenant' } }.to_json, headers: as_b

      expect(response).to have_http_status(:not_found)
      expect(skill.reload.assessor_override).to be_nil
    end

    it "does not read another organization's fit/gap report" do
      create(:fit_gap_report, portfolio:, vacancy:)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: as_b

      expect(response).to have_http_status(:not_found)
    end

    it "does not run fit/gap on another organization's candidate" do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy_b.id }.to_json, headers: as_b

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it "does not regenerate fit/gap on another organization's candidate" do
      report = create(:fit_gap_report, portfolio:, vacancy: vacancy_b)

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy_b.id }.to_json,
                                                                     headers: as_b

      expect(response).to have_http_status(:not_found)
      expect(FitGapReport.exists?(report.id)).to be(true)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end
end
