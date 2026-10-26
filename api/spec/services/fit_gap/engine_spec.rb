# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:scenario) { build_fit_gap_scenario }
  let(:report) do
    create(:fit_gap_report, portfolio: scenario[:portfolio], vacancy: scenario[:vacancy],
                            status: 'generating', skill_comparisons: [])
  end

  def run(client = fake_model(ai_narrative))
    narrator = FitGap::Narrator.new(inputs: FitGap::Inputs.new(portfolio: report.portfolio, vacancy: report.vacancy),
                                    client:)
    described_class.new(report:, narrator:).call
  end

  it 'completes the report with rule-based comparisons, narrative and provenance' do
    run

    expect(report.reload).to have_attributes(status: 'complete', narrative_source: 'ai', error_message: nil,
                                             overall_narrative: 'Probe async communication next.')
    expect(report.skill_comparisons.map { |c| [c['skill_label'], c['result']] }).to eq(
      [%w[React match], %w[Communication gap], ['System Design', 'exceed'], %w[Kubernetes not_assessed]]
    )
    expect(report.inputs_digest).to eq(FitGap::Inputs.new(portfolio: report.portfolio, vacancy: report.vacancy).digest)
  end

  it 'still completes, with a fallback narrative, when the model fails' do
    run(fake_model(error: Gemini::HttpClient::TimeoutError.new('t')))

    expect(report.reload).to have_attributes(status: 'complete', narrative_source: 'fallback', culture_narrative: nil)
  end

  it 'reflects assessor overrides in the stored rows' do
    create(:assessor_override, portfolio_skill: scenario[:skills][:communication], override_level: 3,
                               assessor_notes: 'Strong writing sample')
    run

    row = report.reload.skill_comparisons.find { |c| c['skill_label'] == 'Communication' }
    expect(row).to include('result' => 'match', 'is_override' => true, 'ai_level' => 2,
                           'assessor_notes' => 'Strong writing sample', 'needs_verification' => false)
  end

  it 'leaves the previous result untouched when the write fails (AC16)' do
    report.update!(skill_comparisons: [{ 'skill_label' => 'Old', 'result' => 'match' }], overall_narrative: 'old')
    allow(report).to receive(:update!).and_raise(ActiveRecord::StatementInvalid, 'connection lost')

    expect { run }.to raise_error(ActiveRecord::StatementInvalid)
    expect(FitGapReport.find(report.id)).to have_attributes(overall_narrative: 'old', status: 'generating')
  end
end
