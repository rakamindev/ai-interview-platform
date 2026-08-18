# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:org)       { create_organization }
  let(:assessment) { create_assessment(tenant: org, name: 'Backend Engineer') }
  let(:session)   { build_session(tenant: org, assessment: assessment) }
  let(:portfolio) do
    session.create_portfolio!(candidate_id: 1, generation_status: 'complete')
  end

  # Stub the AI call so the rule-based comparison is what we actually assert on.
  let(:stub_client) do
    Class.new do
      def generate_content(_prompt, _temperature: 0.4)
        { 'culture_narrative' => 'c', 'overall_narrative' => 'o' }
      end
    end.new
  end

  def add_portfolio_skill(skill_id:, label:, level: 4)
    portfolio.portfolio_skills.create!(
      skill_id: skill_id, skill_label: label, is_discovered: false,
      ai_level: level, ai_confidence: 'high',
      evidence: ['quote'], competency_summary: 'summary'
    )
  end

  def add_vacancy_skill(skill_id:, label:, expected: 3)
    vacancy = Vacancy.create!(tenant_id: org.id, created_by: 1, role_title: 'Role')
    vacancy.vacancy_skills.create!(skill_id: skill_id, skill_label: label, expected_level: expected)
    vacancy
  end

  it 'matches by canonical skill_id even when labels differ' do
    add_portfolio_skill(skill_id: 'SK-ENG-002', label: 'Node.js / Backend Development')
    vacancy = add_vacancy_skill(skill_id: 'SK-ENG-002', label: 'Node.js Backend Development')

    report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: stub_client).call

    comparison = report.skill_comparisons.first
    expect(comparison['result']).to eq('exceed')
    expect(comparison['candidate_level']).to eq(4)
  end

  it 'falls back to case-insensitive label matching when skill_id is absent' do
    add_portfolio_skill(skill_id: nil, label: 'Communication')
    vacancy = add_vacancy_skill(skill_id: nil, label: 'communication')

    report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: stub_client).call

    expect(report.skill_comparisons.first['result']).to eq('exceed')
  end

  it 'reports not_assessed when the portfolio has no matching skill' do
    add_portfolio_skill(skill_id: 'SK-ENG-001', label: 'React')
    vacancy = add_vacancy_skill(skill_id: 'SK-ENG-999', label: 'Unrelated Skill')

    report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: stub_client).call

    comparison = report.skill_comparisons.first
    expect(comparison['result']).to eq('not_assessed')
    expect(comparison['candidate_level']).to be_nil
  end

  it 'applies assessor overrides as the effective level' do
    skill = add_portfolio_skill(skill_id: 'SK-ENG-002', label: 'Backend', level: 2)
    skill.create_assessor_override!(
      ai_level: 2, override_level: 4, overridden_by: 1,
      assessor_notes: 'AI underrated'
    )
    vacancy = add_vacancy_skill(skill_id: 'SK-ENG-002', label: 'Backend', expected: 3)

    report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: stub_client).call

    comparison = report.skill_comparisons.first
    expect(comparison['candidate_level']).to eq(4)
    expect(comparison['result']).to eq('exceed')
  end

  it 'falls back to a static narrative when the AI call fails' do
    add_portfolio_skill(skill_id: 'SK-ENG-002', label: 'Backend')
    vacancy = add_vacancy_skill(skill_id: 'SK-ENG-002', label: 'Backend')

    failing_client = Class.new do
      def generate_content(_prompt, _temperature: 0.4)
        raise StandardError, 'boom'
      end
    end.new

    report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: failing_client).call
    expect(report.overall_narrative).to be_present
  end
end
