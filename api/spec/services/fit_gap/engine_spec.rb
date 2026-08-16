# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:session) { create(:session, :with_coverage) }
  let(:portfolio) { create(:portfolio, session: session, generation_status: 'complete') }
  let(:vacancy) { create(:vacancy) }
  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  before do
    allow(gemini_client).to receive(:generate_content).and_return(
      'culture_narrative' => 'Culture fit narrative.',
      'overall_narrative' => 'Overall narrative.'
    )
  end

  describe '#call' do
    it 'returns not_assessed when portfolio skill has no level' do
      create(:portfolio_skill,
             portfolio: portfolio,
             skill_id: 'sk-eng-001',
             skill_label: 'React Development',
             assessment_status: 'not_assessed',
             ai_level: nil,
             ai_confidence: nil,
             competency_summary: PortfolioSkill::NOT_ASSESSED_SUMMARY,
             coverage_state: 'not_yet',
             probe_count: 0)

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client).call
      comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'React Development' }

      expect(comparison['result']).to eq('not_assessed')
      expect(comparison['candidate_level']).to be_nil
      expect(comparison['expected_level']).to eq(3)
    end

    it 'applies assessor override on assessed skills' do
      skill = create(:portfolio_skill, portfolio: portfolio)
      AssessorOverride.create!(
        portfolio_skill: skill,
        ai_level: 3,
        override_level: 4,
        overridden_by: 1
      )

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client).call
      comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'React Development' }

      expect(comparison['candidate_level']).to eq(4)
      expect(comparison['result']).to eq('exceed')
      expect(comparison['is_override']).to be(true)
    end
  end
end
