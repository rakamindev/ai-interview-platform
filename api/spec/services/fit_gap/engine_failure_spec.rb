# frozen_string_literal: true

require 'rails_helper'

# D-8 / AC-47 / AC-50: a failed narrative is a visible failure, never a
# template sentence that reads like an assessment; duplicate jobs exit.
RSpec.describe FitGap::Engine do
  let(:portfolio) { create(:portfolio) }
  # Same organisation as the portfolio, so the worker's tenant guard is not what skips the job.
  let(:vacancy)   { create(:vacancy, organization: Organization.find(portfolio.session.tenant_id)) }

  before do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'Rails', expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Rails', ai_level: 3)
  end

  def run(client)
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call
  end

  {
    'timeout' => [Gemini::HttpClient::TimeoutError.new('timeout'), 'timeout'],
    '503' => [Gemini::HttpClient::ApiError.new('API returned 503', status: 503), 'provider_unavailable'],
    '403' => [Gemini::HttpClient::ApiError.new('API returned 403', status: 403), 'provider_denied'],
    '429' => [Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429), 'rate_limited']
  }.each do |name, (error, code)|
    it "marks the narrative failed with #{code} on a #{name} and stores no fallback text" do
      report = run(FakeGeminiClient.new(nil, error: error))

      expect(report.reload).to have_attributes(status: 'failed', error_code: code, overall_narrative: nil,
                                               culture_narrative: nil, narrative_source: nil)
    end
  end

  it 'marks the narrative failed with empty_output for an empty response' do
    expect(run(FakeGeminiClient.new('')).reload).to have_attributes(status: 'failed', error_code: 'empty_output')
  end

  it 'stores an AI narrative with its source and the digest of the inputs it was based on' do
    report = run(FakeGeminiClient.new({ 'culture_narrative' => 'Contoh budaya.', 'overall_narrative' => 'Contoh.' }))

    expect(report.reload).to have_attributes(
      status: 'complete', narrative_source: 'ai', error_code: nil,
      input_digest: FitGap::ReportPresenter.new(portfolio: portfolio, vacancy: vacancy).input_digest
    )
  end

  it 'lets the worker skip a report that is no longer claimed for generation (AC-50)' do
    create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, status: 'complete')
    allow(described_class).to receive(:new).and_call_original

    FitGapGeneratorWorker.new.perform(portfolio.id, vacancy.id)

    expect(described_class).not_to have_received(:new)
  end
end
