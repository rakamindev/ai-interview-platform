# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:assessment) { create(:assessment) }
  let(:session) { create(:session, assessment: assessment) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy) }
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }

  before do
    # Vacancy requires:
    # 1. React / Frontend (expected L3)
    # 2. System Design (expected L3)
    # 3. Security (expected L2 - not assessed in portfolio)
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'React / Frontend', expected_level: 3)
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'System Design', expected_level: 3)
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'Security', expected_level: 2)

    # Portfolio has:
    # React: AI gave L3, overridden to L4 (exceed)
    # System Design: AI gave L2 (gap)
    # (Security is missing -> not_assessed)
    react = create(:portfolio_skill, portfolio: portfolio, skill_label: 'React / Frontend', ai_level: 3)
    create(:assessor_override, portfolio_skill: react, ai_level: 3, override_level: 4)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: 2)
  end

  describe '#call' do
    context 'when Gemini returns narratives successfully' do
      before do
        allow(mock_gemini_client).to receive(:generate_content).and_return({
          'culture_narrative' => 'Strong culture fit with proactive ownership.',
          'overall_narrative' => 'Recommended hire for frontend-heavy role.'
        })
      end

      it 'builds accurate comparisons applying overrides and marks not_assessed' do
        engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client)
        report = engine.call

        expect(report).to be_persisted
        comparisons = report.skill_comparisons

        react_comp = comparisons.find { |c| c['skill_label'] == 'React / Frontend' }
        expect(react_comp['candidate_level']).to eq(4)
        expect(react_comp['expected_level']).to eq(3)
        expect(react_comp['result']).to eq('exceed')
        expect(react_comp['delta']).to eq(1)

        design_comp = comparisons.find { |c| c['skill_label'] == 'System Design' }
        expect(design_comp['candidate_level']).to eq(2)
        expect(design_comp['expected_level']).to eq(3)
        expect(design_comp['result']).to eq('gap')
        expect(design_comp['delta']).to eq(-1)

        security_comp = comparisons.find { |c| c['skill_label'] == 'Security' }
        expect(security_comp['candidate_level']).to be_nil
        expect(security_comp['result']).to eq('not_assessed')
        expect(security_comp['delta']).to be_nil
      end
    end

    context 'when Gemini fails (P1-3 resilience)' do
      before do
        allow(mock_gemini_client).to receive(:generate_content).and_raise(StandardError.new('Gemini timeout'))
      end

      it 'generates a meaningful fallback culture narrative instead of nil' do
        engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client)
        report = engine.call

        expect(report).to be_persisted
        expect(report.culture_narrative).to be_present
        expect(report.culture_narrative).to include('System Design')
        expect(report.overall_narrative).to include('0 skill matches', '1 exceeds', '1 gaps')
        expect(report.overall_narrative).to include('1 skills were not assessed')
      end
    end
  end
end
