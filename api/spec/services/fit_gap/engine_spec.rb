# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org) { create(:organization) }

  def build_scenario(portfolio_skills:)
    assessment = with_tenant(org) { create(:assessment, :with_skill, tenant: org) }
    sess = with_tenant(org) { create(:session, assessment: assessment, tenant: org) }
    portfolio = with_tenant(org) { create(:portfolio, session: sess) }

    portfolio_skills.each do |attrs|
      with_tenant(org) { create(:portfolio_skill, portfolio: portfolio, **attrs) }
    end

    vacancy = with_tenant(org) do
      v = create(:vacancy, :with_skill, tenant: org)
      v
    end

    [portfolio, vacancy]
  end

  describe '#call comparison payload' do
    it 'marks a vacancy skill as not_assessed when the portfolio row is unassessed' do
      portfolio, vacancy = build_scenario(portfolio_skills: [
        { skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core', ai_level: 3, ai_confidence: 'high' }
      ])
      # Simulate the honest-unassessed path: the interview never reached React.
      with_tenant(org) do
        skill = portfolio.portfolio_skills.first
        skill.update!(assessed: false, ai_level: nil, ai_confidence: nil)
      end

      fake_gemini = instance_double(Gemini::HttpClient)
      allow(fake_gemini).to receive(:generate_content).and_return({ 'culture_narrative' => 'Fits.', 'overall_narrative' => 'Good.' })

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini).call

      comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'React / Frontend Development Core' }
      expect(comparison['result']).to eq('not_assessed')
      expect(comparison['candidate_level']).to be_nil
      expect(comparison['assessed']).to be false
    end

    it 'reports match/gap/exceed for assessed skills' do
      portfolio, vacancy = build_scenario(portfolio_skills: [{ skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core', ai_level: 3, ai_confidence: 'high' }])
      fake_gemini = instance_double(Gemini::HttpClient)
      allow(fake_gemini).to receive(:generate_content).and_return({ 'culture_narrative' => 'Fits.', 'overall_narrative' => 'Good.' })

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini).call
      comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'React / Frontend Development Core' }

      expect(comparison['result']).to eq('match')
      expect(comparison['expected_level']).to eq(3)
      expect(comparison['candidate_level']).to eq(3)
      expect(comparison['delta']).to eq(0)
      expect(comparison['assessed']).to be true
      expect(comparison['overridden']).to be false
    end

    it 'flags overridden skills in the payload' do
      portfolio, vacancy = build_scenario(portfolio_skills: [{ skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core', ai_level: 2, ai_confidence: 'medium' }])
      with_tenant(org) do
        skill = portfolio.portfolio_skills.first
        skill.create_assessor_override!(
          ai_level: 2, override_level: 4, assessor_notes: 'Showed L4 depth in follow-up', overridden_by: 1
        )
      end

      fake_gemini = instance_double(Gemini::HttpClient)
      allow(fake_gemini).to receive(:generate_content).and_return({ 'culture_narrative' => 'Fits.', 'overall_narrative' => 'Good.' })

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini).call
      comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'React / Frontend Development Core' }

      expect(comparison['candidate_level']).to eq(4)
      expect(comparison['overridden']).to be true
      expect(comparison['result']).to eq('exceed')
      expect(comparison['delta']).to eq(1)
    end

    it 'falls back to a rule-based narrative when the LLM call fails' do
      portfolio, vacancy = build_scenario(portfolio_skills: [{ skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core', ai_level: 3, ai_confidence: 'high' }])
      fake_gemini = instance_double(Gemini::HttpClient)
      allow(fake_gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::ApiError.new('boom'))

      report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini).call

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include('1 skill matches')
    end
  end
end
