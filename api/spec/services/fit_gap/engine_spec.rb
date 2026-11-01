require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  # Regression coverage for assessment/03_defining_problem_and_gap_to_ideal_condition.md F3:
  # the frontend's ComparisonTable (web/src/components/fitgap/ComparisonTable.tsx)
  # and its SkillComparison type (web/src/types/index.ts) both read
  # `required_level`. If this spec ever reverts to serializing
  # `expected_level`, the "Required" column in every Fit/Gap Report
  # silently goes blank again.
  let(:fake_gemini) { instance_double(Gemini::HttpClient) }

  let(:vacancy) { create(:vacancy) }
  let!(:vacancy_skill) { create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', skill_id: 'SK-1', expected_level: 3) }

  let(:portfolio) { create(:portfolio) }

  before do
    allow(fake_gemini).to receive(:generate_content).and_return(
      { 'culture_narrative' => 'Good fit.', 'overall_narrative' => 'Proceed.' }
    )
  end

  def run_engine
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini).call
  end

  it 'serializes the vacancy expectation under the required_level key the frontend expects' do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-1', skill_label: 'React', ai_level: 3)

    report = run_engine
    comparison = report.skill_comparisons.first

    expect(comparison).to include('required_level' => 3, 'candidate_level' => 3, 'result' => 'match')
    expect(comparison).not_to have_key('expected_level')
  end

  it 'reports a gap with the correct required_level when the candidate falls short' do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-1', skill_label: 'React', ai_level: 1)

    report = run_engine
    comparison = report.skill_comparisons.first

    expect(comparison).to include('required_level' => 3, 'candidate_level' => 1, 'result' => 'gap', 'delta' => -2)
  end

  it 'reports not_assessed with the required_level still present when no portfolio skill matches' do
    report = run_engine
    comparison = report.skill_comparisons.first

    expect(comparison).to include('required_level' => 3, 'candidate_level' => nil, 'result' => 'not_assessed')
  end
end
