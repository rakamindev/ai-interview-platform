# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:portfolio) { build_portfolio }
  let(:narrative) { { 'culture_narrative' => 'Collaborative.', 'overall_narrative' => 'Recommend a second round.' } }
  let(:gemini)    { InterviewRecords::FakeGemini.new(narrative) }

  def generate(vacancy, client: gemini)
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client).call
  end

  def comparison(report, label)
    report.skill_comparisons.find { |c| c['skill_label'] == label }
  end

  describe 'skill comparison' do
    let(:vacancy) do
      build_vacancy([
        { skill_id: 'sk-1', skill_label: 'Ruby on Rails', expected_level: 3 },
        { skill_id: 'sk-2', skill_label: 'PostgreSQL',    expected_level: 3 },
        { skill_id: 'sk-3', skill_label: 'System Design', expected_level: 4 },
        { skill_id: 'sk-4', skill_label: 'Kubernetes',    expected_level: 2 }
      ])
    end

    before do
      add_portfolio_skill(portfolio, 'Ruby on Rails', skill_id: 'sk-1', level: 3)
      add_portfolio_skill(portfolio, 'PostgreSQL',    skill_id: 'sk-2', level: 5)
      add_portfolio_skill(portfolio, 'System Design', skill_id: 'sk-3', level: 2)
    end

    it 'classifies match, exceed, gap and not_assessed with signed deltas' do
      report = generate(vacancy)

      expect(report.skill_comparisons.map { |c| c.values_at('skill_label', 'result', 'delta') }).to contain_exactly(
        ['Ruby on Rails', 'match', 0],
        ['PostgreSQL', 'exceed', 2],
        ['System Design', 'gap', -2],
        ['Kubernetes', 'not_assessed', nil]
      )
    end

    it 'sends the required level under both payload names the clients read' do
      row = comparison(generate(vacancy), 'System Design')

      expect(row).to include('required_level' => 4, 'expected_level' => 4, 'candidate_level' => 2)
    end

    it 'does not penalise a skill that was never assessed' do
      row = comparison(generate(vacancy), 'Kubernetes')

      expect(row).to include('candidate_level' => nil, 'result' => 'not_assessed',
                             'is_override' => false, 'confidence' => nil)
    end

    it 'uses the assessor override level and flags it' do
      add_override(portfolio.portfolio_skills.find_by(skill_label: 'System Design'), level: 4)

      row = comparison(generate(vacancy), 'System Design')

      expect(row).to include('candidate_level' => 4, 'result' => 'match', 'is_override' => true, 'overridden' => true)
    end
  end

  it 'matches by label case-insensitively when skill ids are absent' do
    add_portfolio_skill(portfolio, 'react / frontend development', level: 3, discovered: true)
    vacancy = build_vacancy([{ skill_label: 'React / Frontend Development', expected_level: 3 }])

    expect(comparison(generate(vacancy), 'React / Frontend Development')['result']).to eq('match')
  end

  it 'stores an empty comparison list for a vacancy without skills' do
    report = generate(build_vacancy([]))

    expect(report).to be_persisted
    expect(report.skill_comparisons).to eq([])
  end

  it 'updates the same report row when generated twice (duplicate job)' do
    vacancy = build_vacancy([{ skill_label: 'Ruby on Rails', expected_level: 3 }])

    first  = generate(vacancy)
    second = generate(vacancy)

    expect(second.id).to eq(first.id)
    expect(FitGapReport.count).to eq(1)
  end

  context 'when the narrative model fails' do
    it 'falls back to a rule-based narrative instead of failing the report' do
      add_portfolio_skill(portfolio, 'Ruby on Rails', level: 2)
      vacancy = build_vacancy([{ skill_label: 'Ruby on Rails', expected_level: 3 }])
      failing = InterviewRecords::FakeGemini.new(Gemini::HttpClient::TimeoutError.new('timeout'))

      report = generate(vacancy, client: failing)

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to eq('Candidate shows 0 skill matches, 0 exceeds, and 1 gaps against role requirements.')
    end
  end
end
