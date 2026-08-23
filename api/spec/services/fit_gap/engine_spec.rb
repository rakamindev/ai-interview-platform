# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: organization.id) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, tenant_id: organization.id) }

  let!(:ps1) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'React Core', ai_level: 3) }
  let!(:ps2) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: 4) }
  let!(:ps3) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Communication', ai_level: 2) }

  let!(:vs1) { create(:vacancy_skill, vacancy: vacancy, skill_label: 'React Core', expected_level: 3) }
  let!(:vs2) { create(:vacancy_skill, vacancy: vacancy, skill_label: 'System Design', expected_level: 3) }
  let!(:vs3) { create(:vacancy_skill, vacancy: vacancy, skill_label: 'Communication', expected_level: 4) }
  let!(:vs4) { create(:vacancy_skill, vacancy: vacancy, skill_label: 'Database SQL', expected_level: 3) }

  let(:mock_gemini) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'culture_narrative' => 'Strong culture alignment and proactive communication.',
        'overall_narrative' => 'Recommended for next interview round.'
      }
    )
  end

  subject { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini) }

  describe '#call' do
    it 'accurately evaluates skill match, gap, exceed, and not_assessed' do
      report = subject.call

      expect(report).to be_persisted
      comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }

      # 1. Match: React Core (Candidate 3 vs Expected 3 -> delta 0)
      expect(comparisons['React Core']['result']).to eq('match')
      expect(comparisons['React Core']['delta']).to eq(0)
      expect(comparisons['React Core']['required_level']).to eq(3)
      expect(comparisons['React Core']['is_override']).to eq(false)

      # 2. Exceed: System Design (Candidate 4 vs Expected 3 -> delta +1)
      expect(comparisons['System Design']['result']).to eq('exceed')
      expect(comparisons['System Design']['delta']).to eq(1)

      # 3. Gap: Communication (Candidate 2 vs Expected 4 -> delta -2)
      expect(comparisons['Communication']['result']).to eq('gap')
      expect(comparisons['Communication']['delta']).to eq(-2)

      # 4. Not Assessed: Database SQL (Candidate nil vs Expected 3 -> delta nil)
      expect(comparisons['Database SQL']['result']).to eq('not_assessed')
      expect(comparisons['Database SQL']['candidate_level']).to be_nil
      expect(comparisons['Database SQL']['delta']).to be_nil
    end

    it 'applies assessor human overrides when evaluating levels' do
      create(:assessor_override, portfolio_skill: ps3, override_level: 4)

      report = subject.call
      comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }

      expect(comparisons['Communication']['candidate_level']).to eq(4)
      expect(comparisons['Communication']['result']).to eq('match')
      expect(comparisons['Communication']['delta']).to eq(0)
      expect(comparisons['Communication']['is_override']).to eq(true)
    end
  end
end
