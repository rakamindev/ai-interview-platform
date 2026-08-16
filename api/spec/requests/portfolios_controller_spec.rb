# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Api::V1::PortfoliosController, type: :request do # rubocop:disable Metrics/BlockLength
  let(:tenant_a) { create(:organization) }
  let(:tenant_b) { create(:organization) }
  let(:headers_a) { auth_header_for(organization: tenant_a) }
  let(:headers_b) { auth_header_for(organization: tenant_b) }

  let!(:portfolio_a) do
    create(:portfolio, session: create(:session, tenant_id: tenant_a.id))
  end

  let!(:portfolio_b) do
    create(:portfolio, session: create(:session, tenant_id: tenant_b.id))
  end

  describe 'cross-tenant isolation' do
    it 'blocks reading another tenant portfolio' do
      get "/api/v1/portfolios/#{portfolio_b.id}/export?format=json", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it 'allows reading own tenant portfolio' do
      get "/api/v1/portfolios/#{portfolio_a.id}/export?format=json", headers: headers_a

      expect(response).to have_http_status(:ok)
    end

    it 'blocks fitgap on another tenant portfolio' do
      post "/api/v1/portfolios/#{portfolio_b.id}/fitgap",
           params: { fitgap: { vacancy_id: 1 } },
           headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it 'blocks regenerate_fitgap on another tenant portfolio' do
      post "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap",
           params: { vacancy_id: 1 },
           headers: headers_a

      expect(response).to have_http_status(:not_found)
    end

    it 'blocks show_fitgap on another tenant portfolio' do
      get "/api/v1/portfolios/#{portfolio_b.id}/fitgap/1", headers: headers_a

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    let(:vacancy) { create(:vacancy) }

    it 'returns 202 and queues generation when the report is missing' do
      Sidekiq::Testing.fake! do
        expect do
          get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy.id}", headers: headers_a
        end.to change { FitGapGeneratorWorker.jobs.size }.by(1)
      end

      expect(response).to have_http_status(:accepted)
      expect(JSON.parse(response.body)['status']).to eq('generating')
    end

    it 'returns the cached report when it already exists' do
      report = create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy)

      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy.id}", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig('report', 'id')).to eq(report.id)
    end

    it 'rejects when the portfolio is not complete' do
      portfolio_a.update!(generation_status: 'failed')

      get "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy.id}", headers: headers_a

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    let(:session) { create(:session, status: 'ended', tenant_id: tenant_a.id) }
    let!(:portfolio) { create(:portfolio, session: session, generation_status: 'failed') }

    it 'queues regeneration for a failed portfolio' do
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(portfolio.reload.generation_status).to eq('pending')
      expect(portfolio.reload.generation_error).to be_nil
    end

    it 'allows regeneration when stuck in generating' do
      portfolio.update!(generation_status: 'generating')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers_a

      expect(response).to have_http_status(:ok)
      expect(portfolio.reload.generation_status).to eq('pending')
    end

    it 'allows regeneration when stuck in pending' do
      portfolio.update!(generation_status: 'pending')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers_a

      expect(response).to have_http_status(:ok)
    end

    it 'rejects regeneration for a complete portfolio' do
      portfolio.update!(generation_status: 'complete')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers_a

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
