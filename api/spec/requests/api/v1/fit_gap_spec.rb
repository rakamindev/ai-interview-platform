# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Fit/gap reports', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session)      { create(:session, assessment: assessment) }
  let(:portfolio)    { create(:portfolio, session: session) }
  let(:vacancy)      { create(:vacancy, tenant_id: organization.id) }
  let(:headers) do
    token = JsonWebToken.encode({ user_id: 7, role: 'admin', scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end

  let!(:design_skill) do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'System Design', expected_level: 4)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: 2, ai_confidence: 'low')
  end

  def comparison(json, label)
    json.dig('report', 'skill_comparisons').find { |c| c['skill_label'] == label }
  end

  # Runs queued fit/gap jobs with the model unavailable, so the narrative falls
  # back to the deterministic summary and no network call is attempted.
  def drain_fit_gap_jobs
    unavailable = double('Gemini', generate_content: nil)
    allow(unavailable).to receive(:generate_content).and_raise(Gemini::HttpClient::ApiError, 'unavailable')
    allow(Gemini::HttpClient).to receive(:new).and_return(unavailable)
    FitGapGeneratorWorker.drain
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    it 'queues one job and answers 202 when no report exists' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker.jobs.map { |j| j['args'] }).to eq([[portfolio.id, vacancy.id]])
    end

    it 'returns a report stored under the current rules without queuing anything' do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, overall_narrative: 'Stored.')

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('report', 'comparator_version')).to eq(FitGap::Comparator::VERSION)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'recomputes a report stored under older rules instead of returning its verdicts' do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, comparator_version: nil,
                              skill_comparisons: [{ skill_label: 'System Design', result: 'gap', delta: -2 }])

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers

      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)

      drain_fit_gap_jobs
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(comparison(response.parsed_body, 'System Design')).to include(
        'result' => 'insufficient_evidence', 'provisional_result' => 'gap', 'ai_level' => 2, 'delta' => nil
      )
      expect(FitGapReport.count).to eq(1)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'does not serve a report stored under older rules' do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, comparator_version: nil)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'requires a token' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}",
          headers: { 'X-Tenant-Scheme' => organization.scheme }

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'GET /api/v1/portfolios/:id/export (json)' do
    it 'leaves out a report stored under older rules' do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, comparator_version: nil)

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json', vacancy_id: vacancy.id },
                                                        headers: headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to include('fit_gap_report' => nil)
    end
  end

  describe 'confirming a provisional rating' do
    it 'turns "needs review" into a verdict once an assessor confirms a level' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers
      drain_fit_gap_jobs
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(comparison(response.parsed_body, 'System Design')).to include('result' => 'insufficient_evidence')

      post "/api/v1/portfolio_skills/#{design_skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Walked through a sharded design in depth.' } },
           headers: headers
      expect(response).to have_http_status(:created)

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:not_found) # recomputing; never the stale verdict

      drain_fit_gap_jobs
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

      expect(comparison(response.parsed_body, 'System Design')).to include(
        'result' => 'match', 'candidate_level' => 4, 'ai_level' => 2, 'overridden' => true
      )
    end
  end

  describe 'another company\'s candidate' do
    let(:other_org)     { create(:organization) }
    let(:other_session) { create(:session, assessment: create(:assessment, tenant_id: other_org.id)) }
    let(:other_portfolio) { create(:portfolio, session: other_session) }
    let!(:other_skill)  { create(:portfolio_skill, portfolio: other_portfolio, ai_level: 2) }
    let!(:other_report) { create(:fit_gap_report, portfolio: other_portfolio, vacancy: vacancy) }

    it 'cannot be read, exported, or queued for computation' do
      requests = [
        -> { get "/api/v1/portfolios/#{other_portfolio.id}/fitgap/#{vacancy.id}", headers: headers },
        -> { post "/api/v1/portfolios/#{other_portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers },
        -> { post "/api/v1/portfolios/#{other_portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id }, headers: headers },
        -> { get "/api/v1/portfolios/#{other_portfolio.id}/export", params: { format: 'json' }, headers: headers }
      ]

      requests.each do |request|
        request.call
        expect(response).to have_http_status(:not_found)
      end
      expect(FitGapGeneratorWorker.jobs).to be_empty
      expect(FitGapReport.exists?(other_report.id)).to be(true)
    end

    it 'cannot have a rating overridden' do
      post "/api/v1/portfolio_skills/#{other_skill.id}/override",
           params: { override: { override_level: 5 } }, headers: headers

      expect(response).to have_http_status(:not_found)
      expect(AssessorOverride.count).to eq(0)
    end
  end
end
