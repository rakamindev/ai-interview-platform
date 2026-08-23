# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let(:user) { create(:user, :admin) }
  let(:headers) { auth_headers(user) }
  let!(:assessment) { create(:assessment, :with_skills, tenant_id: 1) }
  let!(:session) { create(:session, :ended, assessment: assessment) }
  let!(:portfolio) { create(:portfolio, :complete, session: session, candidate_id: 42) }
  let!(:portfolio_skill) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Test Skill') }

  before { with_tenant }

  describe 'GET /api/v1/sessions/:id/portfolio' do
    context 'when portfolio is complete' do
      it 'returns portfolio with skills' do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect_json_response
        expect(json_body['portfolio']['id']).to eq(portfolio.id)
        expect(json_body['portfolio']['skills'].size).to eq(1)
      end
    end

    context 'when portfolio is generating' do
      before { portfolio.update!(generation_status: 'generating') }

      it 'returns 202 with generating status' do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect(response).to have_http_status(:accepted)
        expect(json_body['status']).to eq('generating')
      end
    end

    context 'when portfolio failed' do
      before { portfolio.update!(generation_status: 'failed', generation_error: 'API error') }

      it 'returns portfolio with error' do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect_json_response
        expect(json_body['portfolio']['generation_status']).to eq('failed')
        expect(json_body['error']).to eq('API error')
      end
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    context 'when portfolio is failed' do
      before { portfolio.update!(generation_status: 'failed', generation_error: 'API error') }

      it 'regenerates portfolio' do
        post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

        expect_json_response
        expect(json_body['message']).to eq('Portfolio generation queued')
      end
    end

    context 'when portfolio is not failed' do
      it 'returns error' do
        post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

        expect_error(status: :unprocessable_entity, message: "can only be regenerated when status is 'failed'")
      end
    end

    context 'when no portfolio exists' do
      let(:new_session) { create(:session, :ended, assessment: assessment) }

      it 'returns 404' do
        post "/api/v1/sessions/#{new_session.id}/portfolio/regenerate", headers: headers

        expect_error(status: :not_found)
      end
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    let!(:vacancy) { create(:vacancy, tenant_id: 1) }

    context 'JSON format' do
      it 'exports portfolio as JSON' do
        get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')
        expect(response.headers['Content-Disposition']).to include('portfolio-')
      end
    end

    context 'PDF format' do
      it 'exports portfolio as PDF' do
        get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/pdf')
        expect(response.headers['Content-Disposition']).to include('portfolio-')
      end
    end

    context 'invalid format' do
      it 'returns error' do
        get "/api/v1/portfolios/#{portfolio.id}/export?format=xml", headers: headers

        expect_error(status: :unprocessable_entity, message: "Format must be 'pdf' or 'json'")
      end
    end

    context 'when portfolio not complete' do
      before { portfolio.update!(generation_status: 'pending') }

      it 'returns error' do
        get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: headers

        expect_error(status: :unprocessable_entity, message: 'not ready for export')
      end
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    let!(:vacancy) { create(:vacancy, :with_skills, tenant_id: 1) }

    it 'queues fitgap generation' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id },
           headers: headers

      expect(response).to have_http_status(:accepted)
      expect(json_body['status']).to eq('generating')
    end

    it 'returns cached report if exists' do
      existing = FitGapReport.create!(
        portfolio: portfolio,
        vacancy: vacancy,
        skill_comparisons: [{ skill_label: 'Test Skill', result: 'match' }],
        generated_at: Time.current
      )

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id },
           headers: headers

      expect_json_response
      expect(json_body['report']['id']).to eq(existing.id)
    end

    it 'requires vacancy_id' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", headers: headers

      expect_error(status: :unprocessable_entity, message: 'vacancy_id is required')
    end
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    let!(:vacancy) { create(:vacancy, :with_skills, tenant_id: 1) }

    it 'regenerates fitgap report' do
      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy.id },
           headers: headers

      expect(response).to have_http_status(:accepted)
      expect(json_body['status']).to eq('generating')
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    let!(:vacancy) { create(:vacancy, :with_skills, tenant_id: 1) }
    let!(:report) do
      FitGapReport.create!(
        portfolio: portfolio,
        vacancy: vacancy,
        skill_comparisons: [{ skill_label: 'Test Skill', result: 'match' }],
        generated_at: Time.current
      )
    end

    it 'returns fitgap report' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect_json_response
      expect(json_body['report']['id']).to eq(report.id)
    end

    it 'returns 404 if report not found' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/99999", headers: headers

      expect_error(status: :not_found)
    end
  end
end