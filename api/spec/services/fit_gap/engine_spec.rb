# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  # ── Test data setup ────────────────────────────────────────────────────────
  #
  # We create real DB records to exercise the full pipeline:
  # Portfolio → PortfolioSkill (with optional AssessorOverride)
  # Vacancy  → VacancySkill
  #
  # TenantScoped concern requires tenant context, so we set it via RequestStore.

  let(:tenant_id) { 1 }

  let(:assessment) do
    # Bypass TenantScoped by setting RequestStore
    RequestStore.store[:tenant_id] = tenant_id
    Assessment.create!(
      name: 'Test Assessment',
      time_limit_min: 30,
      tenant_id: tenant_id,
      created_by: 1
    )
  end

  let(:session) do
    Session.create!(
      assessment: assessment,
      tenant_id: tenant_id,
      status: 'ended'
    )
  end

  let(:portfolio) do
    Portfolio.create!(
      session: session,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end

  let(:vacancy) do
    Vacancy.create!(
      role_title: 'Senior Frontend Engineer',
      tenant_id: tenant_id,
      created_by: 1
    )
  end

  # ── Helper: create portfolio skill ─────────────────────────────────────────

  def create_portfolio_skill(attrs = {})
    defaults = {
      portfolio: portfolio,
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      ai_level: 3,
      ai_confidence: 'high',
      evidence: ['Built complex React components'],
      competency_summary: 'Solid React skills'
    }
    PortfolioSkill.create!(defaults.merge(attrs))
  end

  def create_vacancy_skill(attrs = {})
    defaults = {
      vacancy: vacancy,
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      expected_level: 3
    }
    VacancySkill.create!(defaults.merge(attrs))
  end

  # ── Stub Gemini client ─────────────────────────────────────────────────────

  let(:fake_gemini) do
    double('Gemini::HttpClient', generate_content: {
      'culture_narrative' => 'Good culture fit.',
      'overall_narrative' => 'Recommend hire.'
    })
  end

  subject(:engine) do
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini)
  end

  before do
    RequestStore.store[:tenant_id] = tenant_id
  end

  # ══════════════════════════════════════════════════════════════════════════
  # N01: Output uses `required_level` (not `expected_level`)
  # ══════════════════════════════════════════════════════════════════════════

  describe 'skill comparison output keys (N01 seam fix)' do
    before do
      create_portfolio_skill
      create_vacancy_skill(expected_level: 3)
    end

    it 'uses required_level instead of expected_level' do
      report = engine.call
      comparison = report.skill_comparisons.first

      expect(comparison).to have_key('required_level')
      expect(comparison).not_to have_key('expected_level')
    end

    it 'sets required_level to the vacancy expected_level value' do
      create_vacancy_skill(
        skill_id: 'SK-ENG-002',
        skill_label: 'Node.js / Backend Development',
        expected_level: 4
      )
      create_portfolio_skill(
        skill_id: 'SK-ENG-002',
        skill_label: 'Node.js / Backend Development',
        ai_level: 2
      )

      report = engine.call
      node_comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-002' }

      expect(node_comparison['required_level']).to eq(4)
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # N03: Output includes `is_override` boolean
  # ══════════════════════════════════════════════════════════════════════════

  describe 'is_override field (N03 seam fix)' do
    let!(:vacancy_skill) { create_vacancy_skill(expected_level: 3) }

    context 'when no assessor override exists' do
      before { create_portfolio_skill(ai_level: 3) }

      it 'sets is_override to false' do
        report = engine.call
        comparison = report.skill_comparisons.first

        expect(comparison['is_override']).to eq(false)
      end
    end

    context 'when assessor override exists' do
      before do
        skill = create_portfolio_skill(ai_level: 2)
        AssessorOverride.create!(
          portfolio_skill: skill,
          ai_level: 2,
          override_level: 4,
          overridden_by: 1,
          assessor_notes: 'Candidate demonstrated L4 in follow-up'
        )
      end

      it 'sets is_override to true' do
        report = engine.call
        comparison = report.skill_comparisons.first

        expect(comparison['is_override']).to eq(true)
      end

      it 'uses override_level as candidate_level' do
        report = engine.call
        comparison = report.skill_comparisons.first

        expect(comparison['candidate_level']).to eq(4)
      end
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # N02: Output includes `confidence`
  # ══════════════════════════════════════════════════════════════════════════

  describe 'confidence field (N02)' do
    before do
      create_vacancy_skill
      create_portfolio_skill(ai_confidence: 'medium')
    end

    it 'includes confidence from portfolio skill' do
      report = engine.call
      comparison = report.skill_comparisons.first

      expect(comparison['confidence']).to eq('medium')
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # not_assessed: when portfolio skill is missing
  # ══════════════════════════════════════════════════════════════════════════

  describe 'not_assessed result' do
    before do
      create_vacancy_skill(
        skill_id: 'SK-ENG-099',
        skill_label: 'Rust Systems Programming',
        expected_level: 4
      )
      # No matching portfolio skill — simulates skill not covered in interview
    end

    it 'returns not_assessed when portfolio skill is missing' do
      report = engine.call
      comparison = report.skill_comparisons.first

      expect(comparison['result']).to eq('not_assessed')
      expect(comparison['candidate_level']).to be_nil
      expect(comparison['delta']).to be_nil
      expect(comparison['confidence']).to be_nil
      expect(comparison['is_override']).to eq(false)
    end

    it 'still includes required_level for not_assessed skills' do
      report = engine.call
      comparison = report.skill_comparisons.first

      expect(comparison['required_level']).to eq(4)
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # Result classification: match, gap, exceed
  # ══════════════════════════════════════════════════════════════════════════

  describe 'result classification' do
    before { create_vacancy_skill(expected_level: 3) }

    it 'returns match when candidate_level equals required_level' do
      create_portfolio_skill(ai_level: 3)
      report = engine.call
      expect(report.skill_comparisons.first['result']).to eq('match')
      expect(report.skill_comparisons.first['delta']).to eq(0)
    end

    it 'returns exceed when candidate_level is above required_level' do
      create_portfolio_skill(ai_level: 5)
      report = engine.call
      expect(report.skill_comparisons.first['result']).to eq('exceed')
      expect(report.skill_comparisons.first['delta']).to eq(2)
    end

    it 'returns gap when candidate_level is below required_level' do
      create_portfolio_skill(ai_level: 1)
      report = engine.call
      expect(report.skill_comparisons.first['result']).to eq('gap')
      expect(report.skill_comparisons.first['delta']).to eq(-2)
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # Narrative generation fallback
  # ══════════════════════════════════════════════════════════════════════════

  describe 'narrative generation' do
    before do
      create_vacancy_skill
      create_portfolio_skill
    end

    it 'stores culture_narrative and overall_narrative' do
      report = engine.call
      expect(report.culture_narrative).to eq('Good culture fit.')
      expect(report.overall_narrative).to eq('Recommend hire.')
    end

    context 'when Gemini fails' do
      let(:fake_gemini) do
        double('Gemini::HttpClient').tap do |d|
          allow(d).to receive(:generate_content).and_raise(StandardError, 'API timeout')
        end
      end

      it 'falls back to a generated narrative and sets culture_narrative to nil' do
        report = engine.call
        expect(report.culture_narrative).to be_nil
        expect(report.overall_narrative).to include('skill match')
      end
    end
  end
end
