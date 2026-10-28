# frozen_string_literal: true

require 'rails_helper'

# AC1.3, AC1.4, AC4.4: a skill the interview did not measure is "not assessed" in fit/gap, never
# a gap, and the narrative is told so explicitly.
RSpec.describe FitGap::Engine do
  let(:org) { create(:organization) }
  let(:portfolio) { create(:portfolio, organization: org) }
  let(:vacancy) { create(:vacancy, organization: org, role_title: 'Frontend Engineer Intern (fake)') }

  let(:narrative) { { 'culture_narrative' => 'Culture text.', 'overall_narrative' => 'Overall text.' } }

  before do
    { 'SK-ENG-001' => 'React', 'SK-SOFT-001' => 'Communication', 'SK-ENG-009' => 'TypeScript' }.each do |id, label|
      create(:vacancy_skill, vacancy: vacancy, skill_id: id, skill_label: label, expected_level: 2)
    end
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-SOFT-001', skill_label: 'Communication',
                             assessment_status: 'not_assessed', ai_level: nil, ai_confidence: nil,
                             competency_summary: '', status_reason: 'Not discussed in the interview.')
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-009', skill_label: 'TypeScript',
                             assessment_status: 'needs_review', ai_level: nil, ai_confidence: 'medium',
                             status_reason: 'The AI returned no rating for this skill.')
  end

  def run(client = FakeGeminiClient.new(narrative))
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call
  end

  def row(report, label)
    report.skill_comparisons.find { |c| c['skill_label'] == label }
  end

  it 'reports a not-assessed skill as not_assessed, not as a gap (AC1.3)' do
    expect(row(run, 'Communication')).to include('result' => 'not_assessed', 'candidate_level' => nil,
                                                 'delta' => nil)
  end

  it 'reports a needs-review skill as needs_review (AC4.4)' do
    expect(row(run, 'TypeScript')).to include('result' => 'needs_review', 'candidate_level' => nil)
  end

  it 'still compares assessed skills' do
    expect(row(run, 'React')).to include('result' => 'exceed', 'candidate_level' => 3, 'delta' => 1)
  end

  it 'tells the model that not-assessed skills are unknown, not weak (AC1.4)' do
    client = FakeGeminiClient.new(narrative)
    run(client)

    expect(client.prompts.first).to include('Not assessed (1): Communication')
    expect(client.prompts.first).to match(/not.*measured.*do not describe them as (a )?(strength|weakness)/i)
  end

  it 'marks a low-confidence comparison as provisional (AC4.2)' do
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-006', skill_label: 'Testing', expected_level: 2)
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-006', skill_label: 'Testing', ai_level: 2,
                             ai_confidence: 'low')

    expect(row(run, 'Testing')).to include('result' => 'match', 'confidence' => 'low', 'provisional' => true)
    expect(row(run, 'React')).to include('provisional' => false)
  end

  it 'flags overrides and keeps the AI level next to the effective one (AC4.3)' do
    skill = portfolio.portfolio_skills.find_by(skill_label: 'React')
    AssessorOverride.create!(portfolio_skill: skill, ai_level: 3, override_level: 2, overridden_by: 1)

    expect(row(run, 'React')).to include('candidate_level' => 2, 'ai_level' => 3, 'overridden' => true,
                                         'result' => 'match', 'provisional' => false)
  end

  it 'records the rules version it was generated with' do
    expect(run.rules_version).to eq(FitGap::Engine::RULES_VERSION)
  end

  it 'builds the narrative from competency summaries, as PRD-02 specifies (AC4.6)' do
    client = FakeGeminiClient.new(narrative)
    run(client)

    expect(client.prompts.first).to include('React (L3, high confidence): Consistent L3 behaviour across three probes.')
  end

  it 'mentions not-assessed and needs-review skills in the fallback narrative (AC1.4)' do
    report = run(FakeGeminiClient.new(RuntimeError.new('model down')))

    expect(report.overall_narrative).to include('1 not assessed').and include('1 needing review')
  end
end
