# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:organization) { create(:organization) }
  let(:tenant_id) { organization.id }
  let(:session) { create(:session, tenant_id: tenant_id) }
  let(:portfolio) { create(:portfolio, session: session, generation_status: 'complete', tenant_id: tenant_id) }
  let(:vacancy) { create(:vacancy, tenant_id: tenant_id) }

  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client) }

  before do
    Current.tenant_id = tenant_id
  end

  describe 'comparison hash shape' do
    let!(:coverage_map) do
      create(:coverage_map, session: session, skill_label: 'Ruby',
             state: 'covered', probe_count: 4, is_discovered: false)
    end

    let!(:portfolio_skill) do
      create(:portfolio_skill, portfolio: portfolio,
             skill_id: 'sk-ruby', skill_label: 'Ruby',
             ai_level: 4, ai_confidence: 'high',
             evidence: [
               { 'text' => 'I built a caching layer', 'turn_number' => 12 },
               { 'text' => 'We used Redis for pub/sub', 'turn_number' => 18 }
             ],
             competency_summary: 'Strong backend fundamentals.')
    end

    let!(:vacancy_skill) do
      create(:vacancy_skill, vacancy: vacancy,
             skill_id: 'sk-ruby', skill_label: 'Ruby', expected_level: 3)
    end

    before do
      allow(gemini_client).to receive(:generate_content).and_return(
        { 'culture_narrative' => 'Good fit.', 'overall_narrative' => 'Recommended.' }
      )
    end

    it 'includes required_level, is_override, ai_level, override_level, evidence, competency_summary, probe_count, coverage_state' do
      report = engine.call
      comparison = report.skill_comparisons.first

      expect(comparison['required_level']).to eq(3)
      expect(comparison['expected_level']).to eq(3)
      expect(comparison['ai_level']).to eq(4)
      expect(comparison['override_level']).to be_nil
      expect(comparison['assessor_notes']).to be_nil
      expect(comparison['is_override']).to eq(false)
      expect(comparison['evidence']).to be_an(Array)
      expect(comparison['evidence'].first['text']).to eq('I built a caching layer')
      expect(comparison['evidence'].first['turn_number']).to eq(12)
      expect(comparison['competency_summary']).to eq('Strong backend fundamentals.')
      expect(comparison['probe_count']).to eq(4)
      expect(comparison['coverage_state']).to eq('covered')
    end

    context 'when skill is overridden' do
      before do
        create(:assessor_override, portfolio_skill: portfolio_skill,
               ai_level: 4, override_level: 3, assessor_notes: 'Lacks large-scale distributed caching experience',
               overridden_by: 1)
      end

      it 'sets is_override to true, records override_level and assessor_notes, and adjusts delta' do
        report = engine.call
        comparison = report.skill_comparisons.first

        expect(comparison['is_override']).to eq(true)
        expect(comparison['candidate_level']).to eq(3)
        expect(comparison['ai_level']).to eq(4)
        expect(comparison['override_level']).to eq(3)
        expect(comparison['assessor_notes']).to eq('Lacks large-scale distributed caching experience')
        expect(comparison['result']).to eq('match')
        expect(comparison['delta']).to eq(0)
      end
    end

    context 'when skill is not assessed' do
      before do
        vacancy_skill.update!(skill_id: 'sk-python', skill_label: 'Python')
      end

      it 'returns nil candidate_level, empty evidence, and no coverage data' do
        report = engine.call
        comparison = report.skill_comparisons.first

        expect(comparison['candidate_level']).to be_nil
        expect(comparison['is_override']).to eq(false)
        expect(comparison['evidence']).to eq([])
        expect(comparison['competency_summary']).to be_nil
        expect(comparison['probe_count']).to be_nil
        expect(comparison['coverage_state']).to be_nil
      end
    end
  end

  describe 'with legacy string evidence' do
    let!(:portfolio_skill) do
      create(:portfolio_skill, portfolio: portfolio,
             skill_id: 'sk-ruby', skill_label: 'Ruby',
             ai_level: 3, ai_confidence: 'medium',
             evidence: ['Old format quote'],
             competency_summary: 'Decent skills.')
    end

    let!(:vacancy_skill) do
      create(:vacancy_skill, vacancy: vacancy,
             skill_id: 'sk-ruby', skill_label: 'Ruby', expected_level: 3)
    end

    before do
      allow(gemini_client).to receive(:generate_content).and_return(
        { 'culture_narrative' => 'Ok.', 'overall_narrative' => 'Ok.' }
      )
    end

    it 'passes through legacy string evidence unchanged' do
      report = engine.call
      comparison = report.skill_comparisons.first

      expect(comparison['evidence']).to eq(['Old format quote'])
    end
  end
end
