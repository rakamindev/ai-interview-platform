# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios API' do
  let(:org)       { create(:organization) }
  let(:other_org) { create(:organization) }
  let(:headers)   { auth_headers(org) }

  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session)    { create(:session, :ended, assessment: assessment) }
  let(:portfolio)  { create(:portfolio, session: session) }
  let(:vacancy)    { create(:vacancy, tenant_id: org.id) }

  let(:foreign_session)   { create(:session, :ended, assessment: create(:assessment, tenant_id: other_org.id)) }
  let(:foreign_portfolio) { create(:portfolio, session: foreign_session) }

  def json
    JSON.parse(response.body)
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'exposes assessed state, effective level and the override on each skill (AC8)' do
      assessed = create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3)
      unassessed = create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: 'Cloud')
      create(:assessor_override, portfolio_skill: unassessed, ai_level: nil, override_level: 2, assessor_notes: 'Asked in follow-up')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      skills = json['portfolio']['skills'].index_by { |s| s['skill_label'] }
      expect(skills['React']).to include('assessed' => true, 'ai_level' => 3, 'effective_level' => 3, 'override' => nil)
      expect(skills['Cloud']).to include('assessed' => false, 'ai_level' => nil, 'ai_confidence' => nil, 'effective_level' => 2)
      expect(skills['Cloud']['override']).to include('override_level' => 2, 'assessor_notes' => 'Asked in follow-up')
      expect(assessed.id).to eq(skills['React']['id'])
    end

    it "says 'not_ready' while the interview has not ended, instead of 'generating' forever" do
      live = create(:session, assessment: assessment, status: 'active')

      get "/api/v1/sessions/#{live.id}/portfolio", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json).to include('status' => 'not_ready', 'session_status' => 'active')
    end

    it 'reports generation in progress with the last temporary error' do
      portfolio.update!(generation_status: 'generating', generation_error: 'Rate limited')

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:accepted)
      expect(json).to include('status' => 'generating', 'last_error' => 'Rate limited')
    end

    it "returns 404 for another tenant's session (AC9)" do
      foreign_portfolio

      get "/api/v1/sessions/#{foreign_session.id}/portfolio", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'returns 401 without a token' do
      get "/api/v1/sessions/#{session.id}/portfolio", headers: { 'X-Tenant-Scheme' => org.scheme }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate (AC14)' do
    it 'queues exactly one job for a failed portfolio' do
      portfolio.update!(generation_status: 'failed', generation_error: 'Failed after 3 retries: Rate limited')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:ok)
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
      expect(portfolio.reload).to have_attributes(generation_status: 'pending', generation_error: nil)
    end

    it 'refuses a second click while the first is queued' do
      portfolio.update!(generation_status: 'failed')

      2.times { post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers }

      expect(response).to have_http_status(:conflict)
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
    end

    it 'refuses while generation (or a Sidekiq retry) is in progress' do
      portfolio.update!(generation_status: 'generating')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:conflict)
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end
  end

  describe 'fit/gap endpoints' do
    let!(:report) do
      FitGapReport.create!(portfolio: portfolio, vacancy: vacancy, skill_comparisons: [],
                           recommendation_status: 'insufficient_evidence',
                           evidence_gaps: [{ reason: 'no_vacancy_skills', skills: [] }])
    end

    it 'returns the evidence status with the report' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json['report']).to include('recommendation_status' => 'insufficient_evidence',
                                        'evidence_gaps' => [{ 'reason' => 'no_vacancy_skills', 'skills' => [] }])
    end

    it 'queues generation when no report exists yet' do
      report.destroy

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json, headers: headers

      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    describe "another tenant's portfolio (AC9)" do
      # The foreign report exists, so a 404 can only come from tenant isolation.
      let(:foreign_vacancy) { create(:vacancy, tenant_id: other_org.id) }
      before { FitGapReport.create!(portfolio: foreign_portfolio, vacancy: foreign_vacancy, skill_comparisons: []) }

      it('hides the report')      { get "/api/v1/portfolios/#{foreign_portfolio.id}/fitgap/#{foreign_vacancy.id}", headers: headers }
      it('refuses to generate')   { post "/api/v1/portfolios/#{foreign_portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json, headers: headers }
      it('refuses to regenerate') { post "/api/v1/portfolios/#{foreign_portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id }.to_json, headers: headers }
      it('refuses to export')     { get "/api/v1/portfolios/#{foreign_portfolio.id}/export", params: { format: 'json' }, headers: headers }

      after do
        expect(response).to have_http_status(:not_found)
        expect(FitGapGeneratorWorker.jobs).to be_empty
      end
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    let(:skill) { create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: 'Cloud') }

    def override(skill_id, level, notes = 'Rated from follow-up call')
      post "/api/v1/portfolio_skills/#{skill_id}/override",
           params: { override: { override_level: level, assessor_notes: notes } }.to_json, headers: headers
    end

    it 'lets an assessor rate a skill the AI could not assess' do
      override(skill.id, 3)

      expect(response).to have_http_status(:created)
      expect(json['override']).to include('ai_level' => nil, 'override_level' => 3)
    end

    it 'regenerates existing fit/gap reports so they pick up the override' do
      FitGapReport.create!(portfolio: portfolio, vacancy: vacancy, skill_comparisons: [])

      override(skill.id, 3)

      expect(FitGapGeneratorWorker.jobs.map { |j| j['args'] }).to eq([[portfolio.id, vacancy.id]])
    end

    it 'rejects levels outside 1..5' do
      override(skill.id, 6)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(skill.reload.assessor_override).to be_nil
    end

    it "returns 404 for another tenant's skill (AC9)" do
      foreign_skill = create(:portfolio_skill, portfolio: foreign_portfolio)

      override(foreign_skill.id, 1)

      expect(response).to have_http_status(:not_found)
      expect(foreign_skill.reload.assessor_override).to be_nil
    end
  end
end
