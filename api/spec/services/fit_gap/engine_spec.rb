# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org) { create_organization('acme') }
  let(:portfolio) { as_tenant(org) { create(:portfolio) } }
  let(:vacancy) do
    as_tenant(org) do
      create(:vacancy).tap do |v|
        create(:vacancy_skill, vacancy: v, skill_id: 'sk-eng-001', skill_label: 'React', expected_level: 3)
        create(:vacancy_skill, vacancy: v, skill_label: 'Communication', expected_level: 3)
        create(:vacancy_skill, vacancy: v, skill_label: 'System Design', expected_level: 2)
        create(:vacancy_skill, vacancy: v, skill_label: 'SQL', expected_level: 2)
      end
    end
  end
  let(:narrative) { { 'culture_narrative' => 'Direct communicator.', 'overall_narrative' => 'Strong on React.' } }

  before do
    create(:portfolio_skill, portfolio:, skill_id: 'sk-eng-001', skill_label: 'React (Frontend)', ai_level: 3)
    create(:portfolio_skill, portfolio:, skill_label: 'communication', ai_level: 2, ai_confidence: 'low')
    create(:portfolio_skill, :not_assessed, portfolio:, skill_label: 'System Design')
  end

  def run(model = ScriptedModel.new(narrative))
    described_class.new(portfolio:, vacancy:, gemini_client: model).call
  end

  def comparison(report, label) = report.skill_comparisons.find { |c| c['skill_label'] == label }

  it 'never turns a not-assessed skill into a gap' do
    expect(comparison(run, 'System Design')).to include(
      'result' => 'not_assessed', 'candidate_level' => nil, 'delta' => nil,
      'not_assessed_reason' => 'never_reached', 'needs_review' => true
    )
  end

  it 'reports a vacancy skill the interview never covered as not_in_interview' do
    expect(comparison(run, 'SQL')).to include('result' => 'not_assessed', 'not_assessed_reason' => 'not_in_interview')
  end

  it 'sends required_level (what the web reads) and keeps expected_level for older readers' do
    expect(comparison(run, 'React')).to include('required_level' => 3, 'expected_level' => 3, 'result' => 'match', 'delta' => 0)
  end

  it 'matches by skill_id first, then case-insensitive label' do
    report = run
    expect(comparison(report, 'React')['candidate_level']).to eq(3)
    expect(comparison(report, 'Communication')).to include('candidate_level' => 2, 'result' => 'gap', 'delta' => -1)
  end

  it 'flags low-confidence AI ratings for review, and clears the flag once a person overrides' do
    expect(comparison(run, 'Communication')).to include('needs_review' => true, 'is_override' => false)

    skill = portfolio.portfolio_skills.find_by(skill_label: 'communication')
    skill.create_assessor_override!(ai_level: 2, override_level: 3, overridden_by: 1)

    expect(comparison(run, 'Communication')).to include('candidate_level' => 3, 'result' => 'match',
                                                        'is_override' => true, 'needs_review' => false)
  end

  it 'lets an assessor rating fill in a skill the AI could not assess' do
    skill = portfolio.portfolio_skills.find_by(skill_label: 'System Design')
    skill.create_assessor_override!(ai_level: nil, override_level: 3, overridden_by: 1, assessor_notes: 'Follow-up call')

    expect(comparison(run, 'System Design')).to include('result' => 'exceed', 'delta' => 1, 'is_override' => true)
  end

  it 'tells the narrative model not to treat missing evidence as a gap or recommend a hire decision' do
    model = ScriptedModel.new(narrative)
    run(model)
    expect(model.prompts.first).to include('NOT a weakness', 'Do not recommend hiring or rejecting')
  end

  it 'falls back to a deterministic narrative that mentions unassessed skills when the model fails' do
    report = run(ScriptedModel.new(raises: Gemini::HttpClient::TimeoutError.new('t')))

    expect(report.culture_narrative).to be_nil
    expect(report.overall_narrative).to include('1 match', '1 below the required level', '2 not yet assessed')
  end

  it 'falls back when the model returns an object without narrative fields' do
    expect(run(ScriptedModel.new({ 'unexpected' => true })).overall_narrative).to include('not yet assessed')
  end

  it 'updates the existing report instead of creating a duplicate' do
    first = run
    expect(run.id).to eq(first.id)
    expect(FitGapReport.where(portfolio:, vacancy:).count).to eq(1)
  end
end
