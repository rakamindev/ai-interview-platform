# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios API' do
  let(:acme) { create_organization(scheme: 'acme') }
  let(:globex) { create_organization(scheme: 'globex') }
  let(:headers) { auth_headers_for(acme) }

  let!(:acme_session) { as_tenant(acme) { create(:session) } }
  let!(:portfolio) { create(:portfolio, session: acme_session) }
  let!(:vacancy) { as_tenant(acme) { create(:vacancy) } }

  let!(:globex_portfolio) { create(:portfolio, session: as_tenant(globex) { create(:session) }) }
  let!(:globex_vacancy) { as_tenant(globex) { create(:vacancy) } }

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns skills with their rating status and verified evidence' do
      create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 3,
                               evidence: [{ 'quote' => 'I split the state', 'turn_number' => 2 }])
      create(:portfolio_skill, :not_assessed, portfolio:, skill_label: 'System Design')

      get "/api/v1/sessions/#{acme_session.id}/portfolio", headers: headers

      skills = response.parsed_body.dig('portfolio', 'skills')
      expect(skills).to contain_exactly(
        include('skill_label' => 'React', 'rating_status' => 'rated', 'ai_level' => 3,
                'evidence' => [{ 'quote' => 'I split the state', 'turn_number' => 2 }]),
        include('skill_label' => 'System Design', 'rating_status' => 'not_assessed', 'ai_level' => nil, 'ai_confidence' => nil)
      )
    end

    it 'reads old string evidence rows without breaking' do
      create(:portfolio_skill, portfolio:, evidence: ['an older quote'])

      get "/api/v1/sessions/#{acme_session.id}/portfolio", headers: headers

      expect(response.parsed_body.dig('portfolio', 'skills', 0, 'evidence')).to eq([{ 'quote' => 'an older quote', 'turn_number' => nil }])
    end

    it 'reports a pending portfolio as still in progress instead of an empty result' do
      portfolio.update!(generation_status: 'pending')

      get "/api/v1/sessions/#{acme_session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      expect(response.parsed_body['status']).to eq('pending')
    end
  end

  describe 'tenant isolation (F8)' do
    it 'does not export another organization\'s portfolio' do
      get "/api/v1/portfolios/#{globex_portfolio.id}/export", params: { format: 'json' }, headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'does not start fit/gap on another organization\'s portfolio' do
      post "/api/v1/portfolios/#{globex_portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'does not compare against another organization\'s vacancy' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: globex_vacancy.id }.to_json, headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'enqueues at most one job per pair while one is pending (F9)' do
      3.times do
        post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json, headers: headers
      end

      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    let!(:skill) { create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 3) }

    before do
      as_tenant(acme) { create(:vacancy_skill, vacancy:, skill_label: 'React', expected_level: 3) }
      FitGap::Engine.new(portfolio:, vacancy:, gemini_client: FakeGeminiClient.new({})).call
    end

    it 'returns a fresh report as not stale' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response.parsed_body.dig('report', 'stale')).to be(false)
      expect(response.parsed_body.dig('report', 'skill_comparisons', 0)).to include('expected_level' => 3)
    end

    it 'flags the report as stale once the vacancy changes (F6)' do
      vacancy.vacancy_skills.first.update!(expected_level: 4)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response.parsed_body.dig('report', 'stale')).to be(true)
    end
  end
end
