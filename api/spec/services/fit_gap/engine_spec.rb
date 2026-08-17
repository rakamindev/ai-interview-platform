# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let!(:org) { create(:organization) }

  def setup_fixture
    in_tenant(org) do
      assessment = create(:assessment)
      session = create(:session, assessment: assessment, status: 'ended')
      portfolio = create(:portfolio, session: session, generation_status: 'complete')
      portfolio
    end
  end

  def stub_client
    instance_double(Gemini::HttpClient).tap do |client|
      allow(client).to receive(:generate_content) do
        { 'culture_narrative' => 'Culture text', 'overall_narrative' => 'Overall text' }
      end
    end
  end

  describe 'rule-based comparison' do
    it 'marks an unassessed vacancy skill as not_assessed when the candidate has no matching skill' do
      portfolio = setup_fixture
      in_tenant(org) do
        vacancy = create(:vacancy)
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'Communication', expected_level: 3)

        engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: stub_client)
        report = engine.call

        comparison = report.skill_comparisons.first
        expect(comparison['result']).to eq('not_assessed')
        expect(comparison['candidate_level']).to be_nil
        expect(comparison['expected_level']).to eq(3)
      end
    end

    it 'computes gap/match/exceed from effective level (including assessor override)' do
      portfolio = setup_fixture
      in_tenant(org) do
        skill = create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 2)
        create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 4)

        vacancy = create(:vacancy)
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)

        engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: stub_client)
        report = engine.call

        comparison = report.skill_comparisons.first
        expect(comparison['result']).to eq('exceed')
        expect(comparison['candidate_level']).to eq(4)
        expect(comparison['delta']).to eq(1)
      end
    end

    it 'uses a fallback narrative when the AI call fails' do
      portfolio = setup_fixture
      in_tenant(org) do
        vacancy = create(:vacancy)
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3)

        failing_client = instance_double(Gemini::HttpClient)
        allow(failing_client).to receive(:generate_content).and_raise(StandardError, 'model down')

        engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: failing_client)
        report = engine.call

        expect(report.overall_narrative).to include('skill matches')
        expect(report.culture_narrative).to be_nil
      end
    end

    it 'persists tenant_id from the portfolio (worker-safe creation)' do
      portfolio = setup_fixture
      in_tenant(org) do
        vacancy = create(:vacancy)
        create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
        create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3)

        # Simulate worker (no Current tenant) — engine must still persist correctly.
        Current.clear
        engine = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: stub_client)
        report = engine.call

        expect(report.tenant_id).to eq(portfolio.tenant_id)
      end
    end
  end
end