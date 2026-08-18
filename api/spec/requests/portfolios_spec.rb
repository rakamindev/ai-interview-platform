# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio decision contract', type: :request do
  let(:tenant_id) { 9_110 }

  before do
    stub_assessor_auth!(tenant_id: tenant_id)
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
    allow(FitGapGeneratorWorker).to receive(:perform_async)
  end

  def session_record
    @session_record ||= create_ended_session!(tenant_id: tenant_id)
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns 401 when the assessor token is missing' do
      allow_any_instance_of(ApplicationController).to receive(:authenticate_with_roles!).and_call_original
      stub_tenant_only!(tenant_id: tenant_id)

      get "/api/v1/sessions/#{session_record.id}/portfolio"

      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns generating when the session has no portfolio row yet' do
      get "/api/v1/sessions/#{session_record.id}/portfolio"

      expect(response).to have_http_status(:accepted)
      expect(json_body).to eq('status' => 'generating')
    end

    %w[pending generating].each do |status|
      it "returns generating while portfolio is #{status}" do
        create_portfolio!(session: session_record, status: status)

        get "/api/v1/sessions/#{session_record.id}/portfolio"

        expect(response).to have_http_status(:accepted)
        expect(json_body['status']).to eq('generating')
      end
    end

    it 'returns failed with a safe generation_error the frontend can surface' do
      create_portfolio!(
        session: session_record,
        status: 'failed',
        error: 'Model timeout'
      )

      get "/api/v1/sessions/#{session_record.id}/portfolio"

      expect(response).to have_http_status(:ok)
      expect(json_body['status']).to eq('failed')
      expect(json_body['error']).to eq('Model timeout')
      expect(json_body.dig('portfolio', 'generation_status')).to eq('failed')
      expect(json_body.dig('portfolio', 'generation_error')).to eq('Model timeout')
    end

    it 'returns complete with the skill list when generation finished' do
      portfolio = create_portfolio!(session: session_record, status: 'complete')
      create_portfolio_skill!(portfolio)

      get "/api/v1/sessions/#{session_record.id}/portfolio"

      expect(response).to have_http_status(:ok)
      expect(json_body['status']).to eq('complete')
      expect(json_body.dig('portfolio', 'generation_status')).to eq('complete')
      expect(json_body.dig('portfolio', 'skills')).to contain_exactly(
        a_hash_including(
          'skill_label' => 'React',
          'ai_level' => 3,
          'ai_confidence' => 'medium'
        )
      )
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    it 'rejects regenerate when no portfolio exists' do
      post "/api/v1/sessions/#{session_record.id}/portfolio/regenerate"

      expect(response).to have_http_status(:not_found)
      expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
    end

    it 'rejects regenerate unless the portfolio is failed' do
      create_portfolio!(session: session_record, status: 'complete')

      post "/api/v1/sessions/#{session_record.id}/portfolio/regenerate"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig('errors', 0, 'message')).to match(/failed/i)
      expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
    end

    it 'queues generation from failed, clears the error, and rejects a second click while pending' do
      portfolio = create_portfolio!(
        session: session_record,
        status: 'failed',
        error: 'Gemini 429'
      )

      post "/api/v1/sessions/#{session_record.id}/portfolio/regenerate"

      expect(response).to have_http_status(:ok)
      expect(json_body['message']).to match(/queued/i)
      expect(portfolio.reload.generation_status).to eq('pending')
      expect(portfolio.generation_error).to be_nil
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session_record.id).once

      post "/api/v1/sessions/#{session_record.id}/portfolio/regenerate"

      expect(response).to have_http_status(:unprocessable_entity)
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).once
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'rejects export while the portfolio is not complete' do
      portfolio = create_portfolio!(session: session_record, status: 'generating')

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig('errors', 0, 'message')).to match(/not ready/i)
    end

    it 'exports JSON without worker secrets when complete' do
      portfolio = create_portfolio!(session: session_record, status: 'complete')
      create_portfolio_skill!(portfolio)

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }

      expect(response).to have_http_status(:ok)
      payload = JSON.parse(response.body)
      expect(payload['portfolio']['id']).to eq(portfolio.id)
      expect(payload['portfolio']['skills']).not_to be_empty
      expect(payload.to_s).not_to match(/GEMINI|AIza/)
    end

    it 'exports PDF when Gemini text includes characters outside Windows-1252' do
      portfolio = create_portfolio!(session: session_record, status: 'complete')
      skill = create_portfolio_skill!(portfolio)
      skill.update!(
        competency_summary: 'Used “smart quotes” and a bullet • plus ✅',
        evidence: ['Quoted “Product Thinking”']
      )
      skill.create_assessor_override!(
        ai_level: 3,
        override_level: 2,
        overridden_by: 1,
        assessor_notes: 'Override note with arrow → and tick ✅'
      )
      vacancy = create_vacancy!(tenant_id: tenant_id)
      FitGapReport.create!(
        portfolio: portfolio,
        vacancy: vacancy,
        skill_comparisons: [
          {
            'skill_label' => 'Product Thinking',
            'expected_level' => 3,
            'candidate_level' => 2,
            'result' => 'gap',
            'delta' => -1
          }
        ],
        culture_narrative: 'Culture fit — “strong”, with a tick ✅',
        overall_narrative: 'Overall • gap on Product Thinking'
      )

      get "/api/v1/portfolios/#{portfolio.id}/export",
          params: { format: 'pdf', vacancy_id: vacancy.id }

      expect(response).to have_http_status(:ok)
      expect(response.body[0, 4]).to eq('%PDF')
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'requires vacancy_id' do
      portfolio = create_portfolio!(session: session_record, status: 'complete')

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: {}, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'rejects fit-gap when the portfolio is not complete' do
      portfolio = create_portfolio!(session: session_record, status: 'failed', error: 'timeout')
      vacancy = create_vacancy!(tenant_id: tenant_id)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id },
           as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
    end

    it 'queues a poll-friendly generating response for a complete portfolio' do
      portfolio = create_portfolio!(session: session_record, status: 'complete')
      vacancy = create_vacancy!(tenant_id: tenant_id)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { vacancy_id: vacancy.id },
           as: :json

      expect(response).to have_http_status(:accepted)
      expect(json_body['status']).to eq('generating')
      expect(FitGapGeneratorWorker).to have_received(:perform_async).with(portfolio.id, vacancy.id)
    end
  end
end
