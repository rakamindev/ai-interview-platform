# frozen_string_literal: true

require 'rails_helper'

# Characterization spec: documents the current, intended behaviour of the
# rule-based comparison so later fixes can be checked against it.
RSpec.describe FitGap::Engine do
  subject(:report) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call }

  let(:organization)      { create(:organization) }
  let(:interview_session) { create(:session, assessment: create(:assessment, organization: organization)) }
  let(:portfolio)         { create(:portfolio, session: interview_session) }
  let(:vacancy)           { create(:vacancy, organization: organization) }
  let(:gemini) do
    FakeGeminiClient.new({ 'culture_narrative' => 'Contoh narasi budaya.',
                           'overall_narrative' => 'Contoh narasi keseluruhan.' })
  end

  before do
    { 'Ruby on Rails' => 3, 'SQL & Data Modeling' => 3, 'API Design' => 2, 'System Design' => 4 }
      .each { |label, level| create(:vacancy_skill, vacancy: vacancy, skill_label: label, expected_level: level) }

    { 'Ruby on Rails' => 3, 'SQL & Data Modeling' => 2, 'API Design' => 4 }
      .each { |label, level| create(:portfolio_skill, portfolio: portfolio, skill_label: label, ai_level: level) }
  end

  def comparison_for(label)
    report.reload.skill_comparisons.find { |comparison| comparison['skill_label'] == label }
  end

  it 'marks a skill as match when the candidate level equals the expected level' do
    expect(comparison_for('Ruby on Rails'))
      .to include('result' => 'match', 'candidate_level' => 3, 'expected_level' => 3, 'delta' => 0)
  end

  it 'marks a skill as gap when the candidate level is below the expected level' do
    expect(comparison_for('SQL & Data Modeling'))
      .to include('result' => 'gap', 'candidate_level' => 2, 'expected_level' => 3, 'delta' => -1)
  end

  it 'marks a skill as exceed when the candidate level is above the expected level' do
    expect(comparison_for('API Design'))
      .to include('result' => 'exceed', 'candidate_level' => 4, 'expected_level' => 2, 'delta' => 2)
  end

  it 'marks a vacancy skill missing from the portfolio as not_assessed without a level' do
    expect(comparison_for('System Design'))
      .to include('result' => 'not_assessed', 'candidate_level' => nil, 'expected_level' => 4, 'delta' => nil)
  end

  it 'stores the narratives returned by the model after a single call' do
    expect(report.reload).to have_attributes(culture_narrative: 'Contoh narasi budaya.',
                                             overall_narrative: 'Contoh narasi keseluruhan.')
    expect(gemini.calls.size).to eq(1)
  end

  it 'keeps one report per portfolio and vacancy when generated twice' do
    report
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call

    expect(FitGapReport.where(portfolio: portfolio, vacancy: vacancy).count).to eq(1)
  end
end
