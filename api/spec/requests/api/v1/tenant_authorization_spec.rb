# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tenant authorization boundaries', type: :request do
  let(:owner_organization) { create(:organization) }
  let(:foreign_organization) { create(:organization) }
  let(:owner_assessment) { create(:assessment, organization: owner_organization) }
  let(:owner_session) { create(:session, organization: owner_organization, assessment: owner_assessment) }
  let(:owner_portfolio) { create(:portfolio, organization: owner_organization, session: owner_session) }
  let(:owner_skill) { create(:portfolio_skill, portfolio: owner_portfolio) }
  let(:owner_vacancy) { create(:vacancy, organization: owner_organization) }
  let(:foreign_vacancy) { create(:vacancy, organization: foreign_organization) }
  let(:owner_report) do
    create(
      :fit_gap_report,
      portfolio: owner_portfolio,
      vacancy: owner_vacancy,
      skill_comparisons: [{ 'skill_label' => 'Synthetic Skill', 'result' => 'match' }]
    )
  end
  let(:owner_headers) { assessor_headers(owner_organization) }
  let(:foreign_headers) { assessor_headers(foreign_organization) }
  let(:unauthorized_headers) { assessor_headers(owner_organization, role: 'user') }

  describe 'portfolio export' do
    it 'allows the owning tenant to export JSON and PDF' do
      get "/api/v1/portfolios/#{owner_portfolio.id}/export", params: { format: 'json' }, headers: owner_headers
      expect(response).to have_http_status(:ok)
      expect(response.body).to include(owner_portfolio.id.to_s)

      get "/api/v1/portfolios/#{owner_portfolio.id}/export", params: { format: 'pdf' }, headers: owner_headers
      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq('application/pdf')
    end

    it 'denies a foreign tenant without exposing portfolio data' do
      get "/api/v1/portfolios/#{owner_portfolio.id}/export", params: { format: 'json' }, headers: foreign_headers

      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body.dig('errors', 0, 'message')).to eq('Portfolio not found')
      expect(response.body).not_to include(owner_skill.skill_label)
    end

    it 'denies an assessor role that is not authorized for assessor operations' do
      get "/api/v1/portfolios/#{owner_portfolio.id}/export", params: { format: 'json' }, headers: unauthorized_headers

      expect(response).to have_http_status(:forbidden)
      body = JSON.parse(response.body)
      expect(body.dig('errors', 0, 'message')).to eq('Unauthorized request')
    end
  end

  describe 'fit-gap reads and regeneration' do
    it 'allows the owning tenant to read and regenerate a report' do
      allow(FitGapGeneratorWorker).to receive(:perform_async)
      owner_report

      get "/api/v1/portfolios/#{owner_portfolio.id}/fitgap/#{owner_vacancy.id}", headers: owner_headers
      expect(response).to have_http_status(:ok)

      post "/api/v1/portfolios/#{owner_portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: owner_vacancy.id },
           headers: owner_headers,
           as: :json

      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker).to have_received(:perform_async).with(owner_portfolio.id, owner_vacancy.id)
    end

    it 'denies a foreign tenant from reading a fit-gap report' do
      owner_report

      get "/api/v1/portfolios/#{owner_portfolio.id}/fitgap/#{owner_vacancy.id}", headers: foreign_headers

      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include('skill_comparisons')
    end

    it 'denies a foreign tenant from regenerating a report or enqueueing work' do
      allow(FitGapGeneratorWorker).to receive(:perform_async)
      owner_report

      post "/api/v1/portfolios/#{owner_portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: owner_vacancy.id },
           headers: foreign_headers,
           as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
      expect(FitGapReport.exists?(owner_report.id)).to be(true)
    end

    it 'denies a same-tenant request when the vacancy belongs to another tenant' do
      post "/api/v1/portfolios/#{owner_portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: foreign_vacancy.id },
           headers: owner_headers,
           as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'portfolio-skill overrides' do
    it 'allows the owning tenant to override a portfolio skill' do
      allow(FitGapGeneratorWorker).to receive(:perform_async)

      post "/api/v1/portfolio_skills/#{owner_skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Synthetic owner note.' } },
           headers: owner_headers,
           as: :json

      expect(response).to have_http_status(:created)
      expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
      expect(owner_skill.reload.assessor_override.override_level).to eq(4)
    end

    it 'denies a foreign tenant from modifying a portfolio skill' do
      allow(FitGapGeneratorWorker).to receive(:perform_async)

      post "/api/v1/portfolio_skills/#{owner_skill.id}/override",
           params: { override: { override_level: 5, assessor_notes: 'Synthetic foreign attempt.' } },
           headers: foreign_headers,
           as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
      expect(owner_skill.reload.assessor_override).to be_nil
    end
  end
end
