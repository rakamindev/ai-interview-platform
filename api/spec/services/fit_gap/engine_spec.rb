# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:portfolio) { create(:portfolio, generation_status: 'complete') }
  let(:vacancy) { create(:vacancy) }
  let(:gemini) { instance_double(Gemini::HttpClient, generate_content: { 'overall_narrative' => 'Fine.' }) }

  def comparison_for(label)
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
                   .skill_comparisons.find { |c| c['skill_label'] == label }
  end

  it 'never turns a skill the interview did not reach into a gap, even when an older row holds a level' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'Leadership', expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Leadership', status: 'not_assessed', ai_level: 1)

    expect(comparison_for('Leadership'))
      .to include('result' => 'not_assessed', 'candidate_level' => nil, 'delta' => nil, 'skill_status' => 'not_assessed')
  end

  it 'handles a skill with no level at all, and says which kind of absence it is' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'Testing', expected_level: 2)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Testing', status: 'unavailable',
                             ai_level: nil, ai_confidence: nil)

    expect(comparison_for('Testing')).to include('result' => 'not_assessed', 'skill_status' => 'unavailable')
  end

  it "compares a reviewer's level when there is one, and says so" do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
    skill = create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 2)
    AssessorOverride.create!(portfolio_skill: skill, ai_level: 2, override_level: 4, overridden_by: 1)

    expect(comparison_for('React')).to include('result' => 'exceed', 'candidate_level' => 4, 'is_override' => true)
  end
end
