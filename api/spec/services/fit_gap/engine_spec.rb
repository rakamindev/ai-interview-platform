# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:assessment) do
    Assessment.create!(tenant_id: 1, created_by: 1, name: 'Backend Engineer', time_limit_min: 30)
  end
  let(:interview_session) { Session.create!(tenant_id: 1, assessment: assessment) }
  let(:portfolio) do
    interview_session.create_portfolio!(generation_status: 'complete', generated_at: Time.current)
  end
  let(:vacancy) { Vacancy.create!(tenant_id: 1, created_by: 1, role_title: 'Backend Engineer') }
  let(:client) { double('gemini_client') }

  def candidate_skill(label, level:, confidence: 'high')
    portfolio.portfolio_skills.create!(
      skill_label: label, ai_level: level, ai_confidence: confidence,
      evidence: [], competency_summary: 'Summary.'
    )
  end

  def required_skill(label, level)
    vacancy.vacancy_skills.create!(skill_label: label, expected_level: level)
  end

  def run_engine
    allow(client).to receive(:generate_content)
      .and_return('culture_narrative' => 'Culture.', 'overall_narrative' => 'Overall.')
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call
  end

  def comparison(report, label)
    report.reload.skill_comparisons.find { |row| row['skill_label'] == label }
  end

  it 'classifies each required skill as match, gap, exceed, or not assessed' do
    candidate_skill('Ruby', level: 3)
    candidate_skill('SQL', level: 2)
    candidate_skill('Docker', level: 4)
    %w[Ruby SQL Docker Kafka].zip([3, 4, 2, 3]).each { |label, level| required_skill(label, level) }

    report = run_engine

    expect(comparison(report, 'Ruby')).to include('result' => 'match', 'delta' => 0)
    expect(comparison(report, 'SQL')).to include('result' => 'gap', 'delta' => -2)
    expect(comparison(report, 'Docker')).to include('result' => 'exceed', 'delta' => 2)
    expect(comparison(report, 'Kafka')).to include('result' => 'not_assessed', 'candidate_level' => nil)
  end

  it 'uses the assessor override as the candidate level and marks the row' do
    ruby = candidate_skill('Ruby', level: 2)
    AssessorOverride.create!(portfolio_skill: ruby, ai_level: 2, override_level: 4, overridden_by: 1)
    required_skill('Ruby', 4)

    row = comparison(run_engine, 'Ruby')

    expect(row).to include('candidate_level' => 4, 'result' => 'match', 'is_override' => true)
  end

  it 'flags low confidence only when the level comes from the model alone' do
    candidate_skill('Ruby', level: 1, confidence: 'low')
    reviewed = candidate_skill('SQL', level: 1, confidence: 'low')
    AssessorOverride.create!(portfolio_skill: reviewed, ai_level: 1, override_level: 3, overridden_by: 1)
    candidate_skill('Docker', level: 3, confidence: 'high')
    %w[Ruby SQL Docker].each { |label| required_skill(label, 3) }

    report = run_engine

    expect(comparison(report, 'Ruby')).to include('low_confidence' => true, 'is_override' => false)
    expect(comparison(report, 'SQL')).to include('low_confidence' => false, 'is_override' => true)
    expect(comparison(report, 'Docker')).to include('low_confidence' => false)
  end

  it 'does not flag a skill that was never assessed' do
    required_skill('Kafka', 3)

    expect(comparison(run_engine, 'Kafka')).to include('low_confidence' => false, 'is_override' => false)
  end

  it 'still saves the report with a fallback summary when the narrative call fails' do
    candidate_skill('Ruby', level: 3)
    required_skill('Ruby', 3)
    allow(client).to receive(:generate_content).and_raise(StandardError, 'model timeout')

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call

    expect(report).to be_persisted
    expect(report.overall_narrative).to include('1 skill matches')
  end

  it 'says in the fallback summary how many required skills were not assessed' do
    candidate_skill('Ruby', level: 3)
    required_skill('Ruby', 3)
    required_skill('Kafka', 3)
    required_skill('Docker', 2)
    allow(client).to receive(:generate_content).and_raise(StandardError, 'model timeout')

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call

    expect(report.overall_narrative).to include('2 required skills were not assessed')
  end

  it 'updates the existing report when it runs twice for the same pair' do
    candidate_skill('Ruby', level: 3)
    required_skill('Ruby', 3)

    run_engine
    run_engine

    expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
  end
end
