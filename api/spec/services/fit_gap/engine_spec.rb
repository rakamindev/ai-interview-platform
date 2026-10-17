# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:assessment) { create(:assessment) }
  let(:session) { create(:session, assessment: assessment, status: 'ended') }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, role_title: 'Staff Frontend Engineer') }

  let!(:pskill_match) do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-REACT', skill_label: 'React Core', ai_level: 3, ai_confidence: 'high')
  end
  let!(:pskill_gap) do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-SYS', skill_label: 'System Design', ai_level: 2, ai_confidence: 'medium')
  end
  let!(:pskill_overridden) do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-COMM', skill_label: 'Communication', ai_level: 2, ai_confidence: 'medium')
  end

  let!(:override) do
    create(:assessor_override, portfolio_skill: pskill_overridden, ai_level: 2, override_level: 4, assessor_notes: 'Demonstrated L4 mentorship')
  end

  # Vacancy skills
  let!(:vskill_match) { create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-REACT', skill_label: 'React Core', expected_level: 3) }
  let!(:vskill_gap)   { create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-SYS', skill_label: 'System Design', expected_level: 3) }
  let!(:vskill_exceed){ create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-COMM', skill_label: 'Communication', expected_level: 3) }
  let!(:vskill_unassessed) { create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-DEVOPS', skill_label: 'DevOps & CI/CD', expected_level: 3) }

  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini) }

  describe '#call' do
    context 'when Gemini returns narrative response' do
      let(:gemini_response) do
        {
          'culture_narrative' => 'Candidate aligns strongly with engineering excellence principles.',
          'overall_narrative' => 'Solid technical profile with growth headroom in distributed architecture.'
        }
      end

      before do
        allow(mock_gemini).to receive(:generate_content).and_return(gemini_response)
      end

      it 'correctly classifies matches, gaps, exceeds, and unassessed skills' do
        report = engine.call

        expect(report).to be_persisted
        expect(report.culture_narrative).to eq('Candidate aligns strongly with engineering excellence principles.')
        expect(report.overall_narrative).to eq('Solid technical profile with growth headroom in distributed architecture.')

        comparisons = report.skill_comparisons.index_by { |c| c['skill_label'] }

        # Match check
        react_comp = comparisons['React Core']
        expect(react_comp['candidate_level']).to eq(3)
        expect(react_comp['expected_level']).to eq(3)
        expect(react_comp['result']).to eq('match')
        expect(react_comp['delta']).to eq(0)

        # Gap check
        sys_comp = comparisons['System Design']
        expect(sys_comp['candidate_level']).to eq(2)
        expect(sys_comp['expected_level']).to eq(3)
        expect(sys_comp['result']).to eq('gap')
        expect(sys_comp['delta']).to eq(-1)

        # Exceed with override check (AI was 2, override is 4, expected is 3 -> +1 exceed)
        comm_comp = comparisons['Communication']
        expect(comm_comp['candidate_level']).to eq(4)
        expect(comm_comp['expected_level']).to eq(3)
        expect(comm_comp['result']).to eq('exceed')
        expect(comm_comp['delta']).to eq(1)

        # Unassessed check
        devops_comp = comparisons['DevOps & CI/CD']
        expect(devops_comp['candidate_level']).to be_nil
        expect(devops_comp['expected_level']).to eq(3)
        expect(devops_comp['result']).to eq('not_assessed')
        expect(devops_comp['delta']).to be_nil
      end
    end

    context 'when Gemini narrative generation fails' do
      before do
        allow(mock_gemini).to receive(:generate_content).and_raise(StandardError.new('Gemini connection reset'))
      end

      it 'uses robust deterministic fallback narrative instead of failing' do
        report = engine.call

        expect(report).to be_persisted
        expect(report.culture_narrative).to be_present
        expect(report.culture_narrative).to include('alignment with the role')
        expect(report.overall_narrative).to include('1 required skill(s) were not evaluated in this interview and require follow-up assessment')
      end
    end
  end
end
