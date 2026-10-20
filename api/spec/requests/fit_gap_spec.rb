# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Fit/gap API', type: :request do
  let(:org)       { build_org(scheme: 'acme') }
  let(:other_org) { build_org(scheme: 'rival') }
  let(:session)   { build_session(org) }
  let(:portfolio) { build_portfolio(session) }
  let(:vacancy)   { build_vacancy(org, skills: { 'React' => 3, 'SQL' => 3 }) }
  let(:headers)   { auth_headers(org) }
  let(:body)      { JSON.parse(response.body) }

  before { add_portfolio_skill(portfolio, label: 'React', level: 2, confidence: 'low') }

  def post_fitgap(vac = vacancy, hdrs = headers, id: portfolio.id)
    post "/api/v1/portfolios/#{id}/fitgap", params: { fitgap: { vacancy_id: vac.id } }.to_json, headers: hdrs
  end

  describe 'POST /portfolios/:id/fitgap' do
    it 'returns the comparison immediately, using the keys the UI reads, and queues only the narrative' do
      post_fitgap

      expect(response).to have_http_status(:accepted)
      report = body['report']
      expect(report['narrative_status']).to eq('pending')
      expect(report['summary']).to include('total' => 2, 'assessed' => 1, 'coverage_pct' => 50)
      expect(report['skill_comparisons']).to include(
        a_hash_including('skill_label' => 'React', 'required_level' => 3, 'candidate_level' => 2,
                         'result' => 'gap', 'low_evidence' => true, 'is_override' => false),
        a_hash_including('skill_label' => 'SQL', 'result' => 'not_assessed', 'candidate_level' => nil)
      )
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    it 'does not queue another job once the narrative is up to date' do
      post_fitgap
      FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy,
                         gemini_client: double(generate_content: { 'culture_narrative' => 'a', 'overall_narrative' => 'b' }))
                    .generate_narrative!
      Sidekiq::Worker.clear_all

      post_fitgap

      expect(response).to have_http_status(:ok)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'is idempotent for repeated clicks: one report row' do
      2.times { post_fitgap }
      expect(FitGapReport.where(portfolio_id: portfolio.id).count).to eq(1)
    end

    it 'requires a vacancy_id' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: {}.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'refuses a portfolio that is not complete' do
      portfolio.update!(generation_status: 'generating')
      post_fitgap
      expect(response).to have_http_status(:unprocessable_entity)
      expect(FitGapReport.count).to eq(0)
    end

    it 'rejects missing and non-assessor tokens' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: {}.to_json, headers: { 'CONTENT_TYPE' => 'application/json' }
      expect(response).to have_http_status(:forbidden).or have_http_status(:unauthorized)

      post_fitgap(vacancy, auth_headers(org, role: 'candidate'))
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'tenant isolation (UU PDP: another organisation must never see a candidate)' do
    let(:rival_headers) { auth_headers(other_org) }

    it 'hides the portfolio from another tenant on every fit/gap endpoint' do
      rival_vacancy = build_vacancy(other_org, skills: { 'React' => 3 })
      post_fitgap
      expect(response).to have_http_status(:accepted)

      post_fitgap(rival_vacancy, rival_headers)
      expect(response).to have_http_status(:not_found)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: rival_headers
      expect(response).to have_http_status(:not_found)

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: rival_vacancy.id }.to_json, headers: rival_headers
      expect(response).to have_http_status(:not_found)

      get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: rival_headers
      expect(response).to have_http_status(:not_found)
    end

    it 'does not let a tenant combine its own portfolio with another tenant vacancy' do
      rival_vacancy = build_vacancy(other_org, skills: { 'React' => 3 })
      post_fitgap(rival_vacancy)
      expect(response).to have_http_status(:not_found)
      expect(FitGapReport.count).to eq(0)
    end

    it 'does not let another tenant override a skill rating' do
      skill = portfolio.portfolio_skills.first
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 5 } }.to_json, headers: rival_headers
      expect(response).to have_http_status(:not_found)
      expect(AssessorOverride.count).to eq(0)
    end
  end

  describe 'GET /portfolios/:id/fitgap/:vacancy_id' do
    it 'is 404 when no report exists yet' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it 'presents reports stored in the legacy shape in the current shape' do
      FitGapReport.create!(
        portfolio_id: portfolio.id, vacancy_id: vacancy.id,
        skill_comparisons: [{ 'skill_label' => 'React', 'expected_level' => 4, 'candidate_level' => 2,
                              'result' => 'gap', 'delta' => -2, 'confidence' => 'high' }]
      )

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      row = body['report']['skill_comparisons'].first
      expect(row).to include('required_level' => 4, 'is_override' => false)
      expect(body['report']['summary']).to include('total' => 1, 'gap' => 1)
      expect(body['report']['narrative_status']).to eq('ready')
    end
  end

  describe 'POST /portfolios/:id/regenerate_fitgap' do
    it 'keeps the table, flips the narrative to pending and queues one job' do
      post_fitgap
      Sidekiq::Worker.clear_all

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: vacancy.id }.to_json, headers: headers

      expect(response).to have_http_status(:accepted)
      expect(body['report']['skill_comparisons']).not_to be_empty
      expect(body['report']['narrative_status']).to eq('pending')
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end
  end

  describe 'POST /portfolio_skills/:id/override' do
    let(:skill) { portfolio.portfolio_skills.first }

    def override(level, notes = nil, hdrs = headers)
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: level, assessor_notes: notes } }.to_json, headers: hdrs
    end

    it 'updates existing fit/gap reports in place instead of deleting them' do
      post_fitgap
      report_id = FitGapReport.first.id

      override(3, 'Confirmed in follow-up call')

      expect(response).to have_http_status(:created)
      report = FitGapReport.find(report_id)
      expect(report.skill_comparisons.find { |c| c['skill_label'] == 'React' })
        .to include('result' => 'match', 'is_override' => true, 'candidate_level' => 3)
      expect(report.narrative_status).to eq('pending')
    end

    it 'never leaves a window with no report (regression: it used to destroy then re-enqueue)' do
      post_fitgap
      override(3)
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:ok)
    end

    it 'rejects levels outside 1..5 and non-numbers' do
      [0, 6, 'abc', nil, 2.5].each do |bad|
        override(bad)
        expect(response).to have_http_status(:unprocessable_entity), "expected #{bad.inspect} to be rejected"
      end
      expect(AssessorOverride.count).to eq(0)
    end

    it 'rejects excessively long notes' do
      override(3, 'x' * 2001)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'allows changing an override a second time' do
      override(3)
      override(5)
      expect(response).to have_http_status(:ok)
      expect(AssessorOverride.count).to eq(1)
      expect(AssessorOverride.first.override_level).to eq(5)
    end
  end
end
