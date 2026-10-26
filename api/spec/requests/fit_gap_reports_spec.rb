# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Fit/gap reports API' do
  let(:scenario) { build_fit_gap_scenario }
  let(:portfolio) { scenario[:portfolio] }
  let(:vacancy) { scenario[:vacancy] }
  let(:headers) { auth_headers(scenario[:organization]) }
  let(:client) { fake_model(ai_narrative) }

  before { allow(Gemini::HttpClient).to receive(:new).and_return(client) }

  def ensure_report(vacancy_id = vacancy.id)
    post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { fitgap: { vacancy_id: } }.to_json, headers: headers
  end

  def show_report = get("/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers:)
  def body = response.parsed_body
  def report_json = body.fetch('report')

  describe 'POST /portfolios/:id/fitgap' do
    it 'queues the first generation and returns the pending report (202)' do
      ensure_report

      expect(response).to have_http_status(:accepted)
      expect(report_json).to include('status' => 'pending', 'stale' => false, 'skill_comparisons' => [])
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    it 'returns the complete report with the full contract once generated (200)' do
      ensure_report
      FitGapGeneratorWorker.drain
      ensure_report

      expect(response).to have_http_status(:ok)
      expect(report_json).to include('status' => 'complete', 'stale' => false, 'narrative_source' => 'ai',
                                     'error_message' => nil)
      expect(report_json['summary']).to eq('total' => 4, 'match' => 1, 'gap' => 1, 'exceed' => 1,
                                           'not_assessed' => 1, 'needs_verification' => 1)
      expect(report_json['skill_comparisons'].first.keys).to include('expected_level', 'candidate_level',
                                                                      'is_override', 'needs_verification')
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    {
      'missing' => [nil, :unprocessable_entity],
      'non-numeric' => ['abc', :unprocessable_entity],
      'negative' => ['-1', :unprocessable_entity],
      'unknown' => ['999999', :not_found]
    }.each do |name, (vacancy_id, status)|
      it "rejects a #{name} vacancy_id (AC21)" do
        ensure_report(vacancy_id)

        expect(response).to have_http_status(status)
        expect(FitGapGeneratorWorker.jobs).to be_empty
      end
    end

    it 'does not use another tenant\'s vacancy' do
      ensure_report(create(:vacancy).id)

      expect(response).to have_http_status(:not_found)
    end

    it 'refuses while the portfolio is not ready' do
      portfolio.update!(generation_status: 'generating')
      ensure_report

      expect(response).to have_http_status(:unprocessable_entity)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end

  describe 'GET /portfolios/:id/fitgap/:vacancy_id' do
    it 'is 404 before a report was requested' do
      show_report
      expect(response).to have_http_status(:not_found)
    end

    it 'exposes a failed report with a safe message' do
      create(:fit_gap_report, portfolio:, vacancy:, status: 'failed', error_message: nil)
      show_report

      expect(report_json).to include('status' => 'failed',
                                     'error_message' => FitGap::ReportPresenter::FAILED_MESSAGE)
    end

    it 'normalises rows written before the lifecycle migration' do
      create(:fit_gap_report, portfolio:, vacancy:, status: 'complete', inputs_digest: nil,
                              skill_comparisons: [{ 'skill_label' => 'Legacy', 'expected_level' => 3,
                                                    'candidate_level' => 2, 'result' => 'gap', 'delta' => -1 }])
      show_report

      expect(report_json['stale']).to be(true)
      expect(report_json['skill_comparisons'].first).to include('is_override' => false,
                                                                 'needs_verification' => false)
    end
  end

  describe 'assessor override → report refresh (AC11)' do
    before do
      ensure_report
      FitGapGeneratorWorker.drain
    end

    def override!(level)
      post "/api/v1/portfolio_skills/#{scenario[:skills][:communication].id}/override",
           params: { override: { override_level: level, assessor_notes: 'Strong writing sample' } }.to_json,
           headers: headers
    end

    it 'keeps the previous report visible, marked outdated, and queues one refresh' do
      override!(3)
      expect(response).to have_http_status(:created)

      show_report
      expect(response).to have_http_status(:ok)
      expect(report_json).to include('status' => 'pending', 'stale' => true)
      expect(report_json['skill_comparisons'].size).to eq(4)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    it 'shows the override with provenance once regenerated' do
      override!(3)
      FitGapGeneratorWorker.drain
      show_report

      row = report_json['skill_comparisons'].find { |c| c['skill_label'] == 'Communication' }
      expect(report_json).to include('status' => 'complete', 'stale' => false)
      expect(row).to include('candidate_level' => 3, 'ai_level' => 2, 'is_override' => true, 'result' => 'match',
                             'assessor_notes' => 'Strong writing sample')
    end

    it 'collapses rapid successive overrides and page polls into one job (AC14)' do
      override!(3)
      override!(4)
      ensure_report
      ensure_report

      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end
  end

  describe 'POST /portfolios/:id/regenerate_fitgap' do
    it 'forces a refresh without deleting the existing report' do
      ensure_report
      FitGapGeneratorWorker.drain

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id }.to_json, headers: headers

      expect(response).to have_http_status(:accepted)
      expect(report_json['status']).to eq('pending')
      expect(report_json['skill_comparisons'].size).to eq(4)
      expect(FitGapReport.count).to eq(1)
    end
  end

  describe 'GET /portfolios/:id/export?format=json' do
    it 'embeds the same report contract' do
      ensure_report
      FitGapGeneratorWorker.drain

      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json', vacancy_id: vacancy.id }, headers: headers

      report = JSON.parse(response.body)['fit_gap_report']
      expect(report).to include('status' => 'complete', 'summary' => a_hash_including('not_assessed' => 1))
    end
  end

  describe 'authentication and authorization (AC20)' do
    it 'is 401 without a token when the tenant is known' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json,
                                                        headers: { 'Content-Type' => 'application/json',
                                                                   'X-Tenant-Scheme' => scenario[:organization].scheme }
      expect(response).to have_http_status(:unauthorized)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'fails closed (403) when neither tenant nor token can be resolved' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json,
                                                        headers: { 'Content-Type' => 'application/json' }
      expect(response).to have_http_status(:forbidden)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'is 401 with a forged token' do
      forged = JWT.encode({ user_id: 1, role: 'admin', scheme: scenario[:organization].scheme }, 'wrong-secret', 'HS256')
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json,
                                                        headers: headers.merge('Authorization' => "Bearer #{forged}")
      expect(response).to have_http_status(:unauthorized)
    end

    it 'is 403 for a candidate token' do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }.to_json,
                                                        headers: auth_headers(scenario[:organization], role: 'student')
      expect(response).to have_http_status(:forbidden)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end
end
