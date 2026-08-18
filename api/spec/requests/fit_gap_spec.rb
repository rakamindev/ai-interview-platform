# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Fit/gap API contract' do
  let(:auth) { auth_headers(role: 'admin') }
  let(:headers) { auth[0] }
  let(:org) { auth[1] }
  let(:assessment) { with_tenant(org) { create(:assessment) } }
  let(:session) { with_tenant(org) { create(:session, assessment: assessment, status: 'ended', candidate_name: 'Dewi', started_at: 20.minutes.ago) } }
  let(:portfolio) { with_tenant(org) { create(:portfolio, session: session, candidate_id: 2) } }
  let(:vacancy) { with_tenant(org) { create(:vacancy) } }

  before do
    with_tenant(org) do
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development', ai_level: 2, ai_confidence: 'low')
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development', expected_level: 3)
    end
  end

  def enable_inline_fitgap
    # Deterministic unit under test: run the engine synchronously instead of via Sidekiq.
    require 'sidekiq/testing'
    Sidekiq::Testing.inline! do
      yield
    end
  end

  context 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'returns the full comparison contract for the frontend table' do
      report = with_tenant(org) { FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: nil).call }

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      comp = response.parsed_body['report']['skill_comparisons'].first
      expect(comp.keys).to include(
        'skill_label', 'skill_id', 'expected_level', 'candidate_level',
        'result', 'delta', 'confidence', 'is_override', 'low_confidence_flag'
      )
      expect(comp['expected_level']).to eq(3)
      expect(comp['candidate_level']).to eq(2)
      expect(comp['result']).to eq('gap')
      expect(comp['is_override']).to be(false)
      expect(comp['low_confidence_flag']).to be(true)
    end
  end

  context 'POST /api/v1/portfolios/:id/fitgap (idempotency)' do
    it 'does not enqueue duplicate generations while one is in flight' do
      expect do
        post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json,
                                                          headers: headers.merge('Content-Type' => 'application/json')
      end.to change { FitGapGeneratorWorker.jobs.size }.by(1)

      expect(response).to have_http_status(:accepted)

      # Second trigger while the first is still in flight must not queue again.
      expect do
        post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json,
                                                          headers: headers.merge('Content-Type' => 'application/json')
      end.not_to change { FitGapGeneratorWorker.jobs.size }

      expect(response).to have_http_status(:accepted)
    end
  end
end