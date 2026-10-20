# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Fit/gap reports', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, organization:) }
  let(:session)      { create(:session, :ended, assessment:) }
  let(:portfolio)    { create(:portfolio, session:) }
  let(:vacancy)      { create(:vacancy, organization:) }
  let(:headers)      { auth_headers_for(organization) }

  def request_fitgap
    post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { fitgap: { vacancy_id: vacancy.id } }.to_json, headers:
  end

  it 'queues generation and answers 202 when no report exists yet' do
    request_fitgap

    expect(response).to have_http_status(:accepted)
    expect(FitGapGeneratorWorker.jobs.map { |j| j['args'] }).to eq([[portfolio.id, vacancy.id]])
  end

  it 'returns the stored report without queueing another job' do
    create(:fit_gap_report, portfolio:, vacancy:)

    request_fitgap

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig('report', 'skill_comparisons', 0, 'result')).to eq('match')
    expect(FitGapGeneratorWorker.jobs).to be_empty
  end

  it 'refuses to compare a portfolio that is not complete' do
    portfolio.update!(generation_status: 'generating')

    request_fitgap

    expect(response).to have_http_status(:unprocessable_entity)
    expect(FitGapGeneratorWorker.jobs).to be_empty
  end

  it 'requires a vacancy' do
    post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: {}.to_json, headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
  end

  describe 'one job per report (P1-6)' do
    it 'queues only one job while a report is already being generated' do
      request_fitgap
      request_fitgap

      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    it 'hides the claim until the job has written the report' do
      create(:vacancy_skill, vacancy:)
      request_fitgap

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:not_found)

      allow(Gemini::HttpClient).to receive(:new).and_return(instance_double(Gemini::HttpClient, generate_content:
        { 'culture_narrative' => 'C.', 'overall_narrative' => 'O.' }))
      FitGapGeneratorWorker.drain

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:ok)
      expect(FitGapReport.sole).to have_attributes(generation_status: 'complete', requested_at: nil)
    end

    it 'takes over a claim whose job died' do
      request_fitgap
      FitGapGeneratorWorker.clear
      FitGapReport.sole.update_columns(requested_at: (FitGapReport::CLAIM_STALE_AFTER + 1.minute).ago)

      request_fitgap

      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    it 'queues one regeneration however often it is asked for' do
      create(:fit_gap_report, portfolio:, vacancy:)

      2.times do
        post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id }.to_json, headers:
      end

      expect(response).to have_http_status(:accepted)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
      expect(FitGapReport.sole.generation_status).to eq('generating')
    end

    it 'lets only one of two racing claims win' do
      expect(FitGapReport.claim(portfolio_id: portfolio.id, vacancy_id: vacancy.id)).to be(true)
      expect(FitGapReport.claim(portfolio_id: portfolio.id, vacancy_id: vacancy.id)).to be(false)
      expect(FitGapReport.claim(portfolio_id: portfolio.id, vacancy_id: vacancy.id, replace: true)).to be(false)
    end
  end
end
