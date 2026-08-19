# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let(:admin) { create(:admin) }
  let(:headers) { auth_json_headers(admin) }

  describe 'GET /api/v1/sessions/:id/portfolio' do
    context 'when portfolio is complete' do
      let(:session) { create(:session, :ended, :with_portfolio) }
      let!(:skill) { create(:portfolio_skill, portfolio: session.portfolio) }

      it 'returns the portfolio with skills' do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body['portfolio']['generation_status']).to eq('complete')
        expect(body['portfolio']['skills']).to be_present
      end
    end

    context 'when portfolio is generating' do
      let(:session) { create(:session, :ended) }
      before { create(:portfolio, :generating, session: session) }

      it 'returns accepted status' do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect(response).to have_http_status(:accepted)
        expect(JSON.parse(response.body)['status']).to eq('generating')
      end
    end

    context 'when portfolio is failed' do
      let(:session) { create(:session, :ended) }
      before { create(:portfolio, :failed, session: session) }

      it 'returns portfolio with error' do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body['portfolio']['generation_status']).to eq('failed')
        expect(body['error']).to be_present
      end
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    let(:session) { create(:session, :ended) }
    before { create(:portfolio, :failed, session: session) }

    it 'queues regeneration' do
      allow(PortfolioGeneratorWorker).to receive(:perform_async)

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:ok)
      expect(PortfolioGeneratorWorker).to have_received(:perform_async)
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    let(:session) { create(:session, :ended) }
    let(:portfolio) { create(:portfolio, :with_skills, session: session) }

    context 'JSON format' do
      it 'returns JSON export' do
        get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')
      end
    end

    context 'when portfolio is not complete' do
      let(:generating_portfolio) { create(:portfolio, :generating, session: session) }

      it 'returns error' do
        get "/api/v1/portfolios/#{generating_portfolio.id}/export?format=json", headers: headers

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end
end
