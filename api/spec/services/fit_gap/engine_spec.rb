# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  include_context 'with tenant'

  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }

  def comparison_for(label, report) = report.skill_comparisons.find { |c| c['skill_label'] == label }

  def generate(mode = :happy)
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: stub_gemini(mode)).call
  end

  describe 'the contract the client actually reads' do
    before do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-1', skill_label: 'Distributed Systems', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-1', skill_label: 'Distributed Systems', ai_level: 3)
    end

    it 'emits required_level, which the table renders in its Required column' do
      expect(comparison_for('Distributed Systems', generate)['required_level']).to eq(3)
    end

    it 'still emits expected_level so an unmigrated client keeps working' do
      row = comparison_for('Distributed Systems', generate)

      expect(row['expected_level']).to eq(row['required_level'])
    end

    it 'emits is_override, which drives the override marker' do
      expect(comparison_for('Distributed Systems', generate)['is_override']).to be(false)
    end

    it 'carries confidence through to the decision point' do
      expect(comparison_for('Distributed Systems', generate)['confidence']).to eq('high')
    end
  end

  describe 'a skill with no evidence' do
    before do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-2', skill_label: 'Incident Response', expected_level: 4)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-2', skill_label: 'Incident Response',
                               assessment_state: 'not_probed', ai_level: nil, ai_confidence: nil)
    end

    it 'is reported as not_assessed, never as a gap' do
      row = comparison_for('Incident Response', generate)

      expect(row['result']).to eq('not_assessed')
      expect(row['result']).not_to eq('gap')
    end

    it 'carries no candidate level and no delta' do
      row = comparison_for('Incident Response', generate)

      expect(row['candidate_level']).to be_nil
      expect(row['delta']).to be_nil
    end
  end

  describe 'assessor overrides' do
    before do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-3', skill_label: 'Data Modelling', expected_level: 3)
      skill = create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-3',
                                       skill_label: 'Data Modelling', ai_level: 2)
      create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 4)
    end

    it 'compares against the human rating, not the model rating' do
      row = comparison_for('Data Modelling', generate)

      expect(row['candidate_level']).to eq(4)
      expect(row['result']).to eq('exceed')
    end

    it 'shows the provenance of the rating it used' do
      row = comparison_for('Data Modelling', generate)

      expect(row['is_override']).to be(true)
      expect(row['ai_level']).to eq(2)
      expect(row['override_level']).to eq(4)
    end
  end

  describe 'skills outside the vacancy' do
    before do
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-9', skill_label: 'Observability', ai_level: 4)
    end

    it 'still appears, rather than being dropped from the candidate\'s own report' do
      row = comparison_for('Observability', generate)

      expect(row).to be_present
      expect(row['result']).to eq('additional')
      expect(row['in_vacancy']).to be(false)
    end
  end

  describe 'label matching' do
    before do
      create(:vacancy_skill, vacancy: vacancy, skill_id: nil, skill_label: 'React', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: nil, skill_label: '  react  ', ai_level: 3)
    end

    it 'matches across surrounding whitespace and case' do
      expect(comparison_for('React', generate)['result']).to eq('match')
    end
  end

  describe 'when narrative generation fails' do
    before do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-1', skill_label: 'Distributed Systems', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-1', skill_label: 'Distributed Systems', ai_level: 3)
    end

    it 'still persists the rule-based comparison' do
      report = generate(:timeout)

      expect(report.skill_comparisons).to be_present
      expect(comparison_for('Distributed Systems', report)['result']).to eq('match')
    end

    it 'says so explicitly instead of leaving the client to infer it from a null' do
      expect(generate(:timeout).narrative_status).to eq('failed')
    end

    it 'does not pass arithmetic off as a culture analysis' do
      report = generate(:timeout)

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include('narrative generation unavailable')
    end
  end
end
