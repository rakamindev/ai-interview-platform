# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio reports', type: :request do
  let(:organization) { create(:organization) }
  let(:interview) { create(:session, assessment: create(:assessment, tenant_id: organization.id)) }
  let(:headers) { auth_headers(organization) }

  def body
    JSON.parse(response.body)
  end

  def report(status, **attrs)
    create(:portfolio, session: interview, generation_status: status, **attrs)
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'answers 200 with the state while the report is being made' do
      report('generating')

      get "/api/v1/sessions/#{interview.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      expect(body['portfolio']).to include('state' => 'generating', 'generation_status' => 'generating')
    end

    it 'answers 404 with a stable code when no report was started' do
      get "/api/v1/sessions/#{interview.id}/portfolio", headers: headers

      expect(response).to have_http_status(:not_found)
      expect(body['errors'].first['code']).to eq('report_not_started')
    end

    it 'explains a failure without the raw error text' do
      report('failed', failure_kind: 'model_unavailable', generation_error: 'API returned 503: busy')

      get "/api/v1/sessions/#{interview.id}/portfolio", headers: headers

      expect(body['portfolio']['failure']).to include('kind' => 'model_unavailable', 'retryable' => true)
      expect(response.body).not_to include('API returned 503')
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    def try_again
      post "/api/v1/sessions/#{interview.id}/portfolio/regenerate", headers: headers
    end

    it 'queues a new try for a failure that trying again can fix' do
      report('failed', failure_kind: 'model_unavailable')

      expect { try_again }.to change(PortfolioGeneratorWorker.jobs, :size).by(1)
      expect(response).to have_http_status(:ok)
      expect(body['portfolio']).to include('state' => 'pending', 'failure' => nil)
    end

    it 'restarts a report whose job stopped' do
      report('generating').update_column(:status_changed_at, 6.minutes.ago)

      expect { try_again }.to change(PortfolioGeneratorWorker.jobs, :size).by(1)
      expect(response).to have_http_status(:ok)
    end

    it 'refuses when the interview has no data, since trying again cannot help' do
      report('failed', failure_kind: 'no_interview_data')

      expect { try_again }.not_to change(PortfolioGeneratorWorker.jobs, :size)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(body['errors'].first['code']).to eq('not_retryable')
    end

    it 'refuses to overwrite a finished report' do
      create(:portfolio_skill, portfolio: report('complete'))

      try_again

      expect(body['errors'].first['code']).to eq('not_retryable')
    end

    it 'refuses to overwrite a partial report that someone has reviewed' do
      portfolio = report('complete')
      reviewed = create(:portfolio_skill, portfolio: portfolio, ai_level: 3)
      create(:portfolio_skill, portfolio: portfolio, status: 'unavailable', ai_level: nil, ai_confidence: nil)
      AssessorOverride.create!(portfolio_skill: reviewed, ai_level: 3, override_level: 4, overridden_by: 1)

      expect { try_again }.not_to change(PortfolioGeneratorWorker.jobs, :size)
      expect(body['errors'].first['code']).to eq('not_retryable')
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'refuses a report that is not complete' do
      portfolio = report('complete')
      create(:portfolio_skill, portfolio: portfolio, status: 'unavailable', ai_level: nil, ai_confidence: nil)
      vacancy = create(:vacancy, tenant_id: organization.id)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body['errors'].first['code']).to eq('report_not_complete')
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'refuses to export a report that is not complete' do
      portfolio = report('complete')
      create(:portfolio_skill, portfolio: portfolio, status: 'unavailable', ai_level: nil, ai_confidence: nil)

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(body['errors'].first['code']).to eq('report_not_complete')
    end

    it 'exports the same honest data the page gets' do
      portfolio = report('complete', generation_error: 'details for operators')
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Leadership', status: 'not_assessed', ai_level: 1)

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: headers

      exported = JSON.parse(response.body)['portfolio']
      expect(exported['state']).to eq('complete')
      expect(exported['skills'].first).to include('skill_label' => 'Leadership', 'ai_level' => nil)
      expect(response.body).not_to include('details for operators')
    end
  end
end
