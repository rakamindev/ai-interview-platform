# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }
  let(:gemini)    { instance_double(Gemini::HttpClient) }

  before do
    allow(gemini).to receive(:generate_content)
      .and_return({ 'culture_narrative' => 'Culture text', 'overall_narrative' => 'Overall text' })
  end

  def require_skill(label, level)
    create(:vacancy_skill, vacancy: vacancy, skill_label: label, expected_level: level)
  end

  def comparison(label)
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini)
                   .call.skill_comparisons.find { |c| c['skill_label'] == label }
  end

  it 'compares assessed skills by level' do
    require_skill('System Design', 3)
    require_skill('Testing', 3)
    require_skill('Communication', 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Testing', ai_level: 2)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'communication', ai_level: 4)

    expect(comparison('System Design')).to include('result' => 'match', 'delta' => 0, 'expected_level' => 3)
    expect(comparison('Testing')).to include('result' => 'gap', 'delta' => -1)
    expect(comparison('Communication')).to include('result' => 'exceed', 'delta' => 1)
  end

  it 'reports a skill the interview never reached as not assessed, not as a gap' do
    require_skill('Testing', 3)
    create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: 'Testing')

    expect(comparison('Testing')).to include(
      'result' => 'not_assessed', 'candidate_level' => nil, 'delta' => nil, 'not_assessed_reason' => 'not_covered'
    )
  end

  it 'explains when the evidence was not enough' do
    require_skill('Testing', 3)
    create(:portfolio_skill, :insufficient_evidence, portfolio: portfolio, skill_label: 'Testing')

    expect(comparison('Testing')).to include('result' => 'not_assessed', 'not_assessed_reason' => 'insufficient_evidence')
  end

  it 'explains when the skill was not part of the interview' do
    require_skill('Kubernetes', 2)

    expect(comparison('Kubernetes')).to include('result' => 'not_assessed', 'not_assessed_reason' => 'not_in_assessment')
  end

  it 'uses the assessor override and flags it' do
    require_skill('Testing', 3)
    skill = create(:portfolio_skill, portfolio: portfolio, skill_label: 'Testing', ai_level: 2)
    create(:assessor_override, portfolio_skill: skill, override_level: 3)

    expect(comparison('Testing')).to include('candidate_level' => 3, 'result' => 'match', 'is_override' => true)
  end

  it 'tells the narrative model that not assessed is not a weakness' do
    require_skill('Testing', 3)

    comparison('Testing')

    expect(gemini).to have_received(:generate_content).with(include('It is NOT evidence of weakness'), anything)
  end

  it 'mentions unassessed skills in the fallback narrative when the model fails' do
    require_skill('Testing', 3)
    allow(gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError.new('timeout'))

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call

    expect(report.overall_narrative).to include('1 required skills were not assessed')
    expect(report.culture_narrative).to be_nil
  end

  it 'updates the existing report instead of failing on the unique index' do
    require_skill('Testing', 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Testing', ai_level: 3)
    2.times { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call }

    expect(FitGapReport.where(portfolio: portfolio, vacancy: vacancy).count).to eq(1)
  end
end
