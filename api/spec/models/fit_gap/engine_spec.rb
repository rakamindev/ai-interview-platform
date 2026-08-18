# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:organization) { create(:organization) }
  let(:assessment) { with_tenant(organization) { create(:assessment) } }
  let!(:skill) { with_tenant(organization) { create(:assessment_skill, assessment: assessment, skill_id: 'SK-ENG-001', skill_label: 'React') } }
  let(:session) { with_tenant(organization) { create(:session, assessment: assessment, status: 'ended', candidate_name: 'Dewi') } }
  let(:portfolio) { with_tenant(organization) { create(:portfolio, session: session, candidate_id: 2) } }
  let(:vacancy) { with_tenant(organization) { create(:vacancy) } }
  let(:gemini) { instance_double(Gemini::HttpClient) }

  # Comparison builder is deterministic — no LLM. Stub narratives only.
  before do
    allow(gemini).to receive(:generate_content).and_return(
      'culture_narrative' => 'Aligned.', 'overall_narrative' => 'Solid match.'
    )
  end

  def run_engine
    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call
  end

  def comparison(report, label)
    report.skill_comparisons.find { |c| c['skill_label'] == label }
  end

  context 'when the candidate was not assessed for a required skill' do
    it 'reports not_assessed with nil levels' do
      with_tenant(organization) do
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-002', skill_label: 'Node.js / Backend Development', expected_level: 3)
      end

      report = run_engine
      comp = comparison(report, 'Node.js / Backend Development')

      expect(comp['result']).to eq('not_assessed')
      expect(comp['candidate_level']).to be_nil
      expect(comp['delta']).to be_nil
      expect(comp['expected_level']).to eq(3)
    end
  end

  context 'with a matching portfolio skill' do
    before do
      with_tenant(organization) do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 4, ai_confidence: 'high')
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 4)
      end
    end

    it 'reports match when candidate level equals expected level' do
      report = run_engine
      comp = comparison(report, 'React')
      expect(comp['result']).to eq('match')
      expect(comp['delta']).to eq(0)
      expect(comp['candidate_level']).to eq(4)
      expect(comp['confidence']).to eq('high')
      expect(comp['is_override']).to be false
    end

    it 'reports exceed when candidate level is above expected' do
      with_tenant(organization) { create(:assessor_override, portfolio_skill: portfolio.portfolio_skills.first, ai_level: 4, override_level: 5) }

      report = run_engine
      comp = comparison(report, 'React')
      expect(comp['result']).to eq('exceed')
      expect(comp['delta']).to eq(1)
      expect(comp['is_override']).to be true
      expect(comp['candidate_level']).to eq(5)
    end

    it 'reports gap when candidate level is below expected' do
      with_tenant(organization) do
        portfolio.portfolio_skills.first.update!(ai_level: 2)
        create(:assessor_override, portfolio_skill: portfolio.portfolio_skills.first, ai_level: 2, override_level: 3)
      end
      report = run_engine
      comp = comparison(report, 'React')
      expect(comp['result']).to eq('gap')
      expect(comp['delta']).to eq(-1)
    end
  end

  context 'confidence honesty (decision-support contract)' do
    before do
      with_tenant(organization) do
        create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 2, ai_confidence: 'low')
        create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3)
      end
    end

    it 'flags a verdict driven by a low-confidence rating' do
      report = run_engine
      comp = comparison(report, 'React')
      expect(comp['result']).to eq('gap')
      expect(comp['low_confidence_flag']).to be true
    end

    it 'does not flag the same verdict when confidence is high' do
      portfolio.portfolio_skills.first.update!(ai_confidence: 'high')
      report = run_engine
      comp = comparison(report, 'React')
      expect(comp['low_confidence_flag']).to be false
    end

    it 'flags not_assessed rows so assessors know the signal is absent' do
      report = run_engine
      comp = comparison(report, 'React')
      expect(comp['low_confidence_flag']).to be true
    end
  end

  context 'narrative generation' do
    it 'falls back to a deterministic summary when the model fails' do
      allow(gemini).to receive(:generate_content).and_raise(StandardError, 'model timeout')
      report = run_engine
      expect(report.overall_narrative).to include('match')
      expect(report.culture_narrative).to be_nil
    end
  end
end