# frozen_string_literal: true

require 'rails_helper'
require 'sidekiq/testing'

# Job lifecycle & API contract for fit/gap reports — assessment/02-strategy.md AC10–AC17.
RSpec.describe 'Fit/gap reports API', type: :request do
  let(:org)       { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: create(:session, assessment: assessment)) }
  let(:vacancy)   { create(:vacancy, tenant_id: org.id) }
  let(:headers) do
    token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end

  let(:trigger_path) { "/api/v1/portfolios/#{portfolio.id}/fitgap" }
  let(:show_path)    { "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}" }

  around { |example| Sidekiq::Testing.fake! { example.run } }
  before { FitGapGeneratorWorker.clear }

  def trigger
    post trigger_path, params: { fitgap: { vacancy_id: vacancy.id } }, headers: headers, as: :json
  end

  def report_row
    FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
  end

  def create_report(status:, **attrs)
    FitGapReport.create!(portfolio: portfolio, vacancy: vacancy, status: status,
                         skill_comparisons: attrs.delete(:skill_comparisons) || [], **attrs)
  end

  describe 'POST /portfolios/:id/fitgap' do
    it 'records a generating report and enqueues exactly one job (AC10)' do
      trigger

      expect(response).to have_http_status(:accepted)
      expect(report_row).to have_attributes(status: 'generating')
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    it 'does not enqueue again while a report is generating (AC11)' do
      trigger
      2.times { trigger }

      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    it 'returns a ready report without enqueuing (AC12)' do
      create_report(status: 'ready', overall_narrative: 'Done')

      trigger

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('report', 'status')).to eq('ready')
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'retries a failed report (AC13)' do
      create_report(status: 'failed', error_message: 'Report generation failed')

      trigger

      expect(response).to have_http_status(:accepted)
      expect(report_row.reload).to have_attributes(status: 'generating', error_message: nil)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end
  end

  describe 'GET /portfolios/:id/fitgap/:vacancy_id' do
    it 'returns 404 only when no report exists (AC15)' do
      get show_path, headers: headers

      expect(response).to have_http_status(:not_found)
    end

    %w[generating failed].each do |status|
      it "returns the #{status} report with its status instead of 404 (AC15)" do
        create_report(status: status)

        get show_path, headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body.dig('report', 'status')).to eq(status)
      end
    end

    it 'exposes status, narrative source, summary and error message (AC17)' do
      comparisons = [
        { 'skill_label' => 'SQL', 'expected_level' => 4, 'candidate_level' => 2, 'result' => 'gap', 'delta' => -2,
          'is_override' => false, 'low_confidence' => true },
        { 'skill_label' => 'Go', 'expected_level' => 3, 'candidate_level' => nil, 'result' => 'not_assessed',
          'delta' => nil, 'is_override' => false, 'low_confidence' => false }
      ]
      create_report(status: 'ready', narrative_source: 'fallback', skill_comparisons: comparisons)

      get show_path, headers: headers

      body = response.parsed_body['report']
      expect(body).to include('status' => 'ready', 'narrative_source' => 'fallback', 'error_message' => nil)
      expect(body['summary']).to include('total' => 2, 'assessed' => 1, 'not_assessed' => 1, 'coverage_pct' => 50,
                                         'gap' => 1, 'low_confidence' => 1)
    end
  end

  describe 'POST /portfolio_skills/:id/override' do
    it 'keeps existing reports and marks them for regeneration instead of deleting them (AC16)' do
      skill = create(:portfolio_skill, portfolio: portfolio)
      create_report(status: 'ready', overall_narrative: 'Before override')

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 5, assessor_notes: 'Strong live demo' } }, headers: headers, as: :json

      expect(response).to have_http_status(:created)
      expect(report_row).to have_attributes(status: 'generating', overall_narrative: 'Before override')
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end
  end
end
