# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  # The narrative step is optional for these checks; an empty JSON reply just leaves the narratives blank.
  let(:gemini) { Class.new { def generate_content(*, **) = '{}' }.new }

  let(:assessment) { Assessment.create!(tenant_id: 1, created_by: 1, name: 'Backend Engineer', time_limit_min: 30) }
  let(:session)    { Session.create!(assessment:, tenant_id: 1, status: 'ended', end_reason: 'manual_candidate') }
  let(:portfolio)  { Portfolio.create!(session:, generation_status: 'complete') }
  let(:vacancy)    { Vacancy.create!(tenant_id: 1, created_by: 1, role_title: 'Backend Engineer') }

  # Returns the result for the single vacancy skill that was compared.
  def compare(portfolio_skill:, vacancy_skill:)
    portfolio.portfolio_skills.create!(
      is_discovered: false, ai_level: 3, ai_confidence: 'high', competency_summary: 'Ringkasan', **portfolio_skill
    )
    vacancy.vacancy_skills.create!(expected_level: 3, **vacancy_skill)

    report = described_class.new(portfolio:, vacancy:, gemini_client: gemini).call
    report.reload.skill_comparisons.first['result']
  end

  it 'matches by catalog code even when the AI wrote a different label' do
    result = compare(
      portfolio_skill: { skill_id: 'SK-ENG-002', skill_label: 'Node JS' },
      vacancy_skill:   { skill_id: 'SK-ENG-002', skill_label: 'Node.js / Backend Development' }
    )

    expect(result).to eq('match')
  end

  it 'matches the catalog code regardless of letter case, since the AI may lowercase it' do
    result = compare(
      portfolio_skill: { skill_id: 'sk-eng-002', skill_label: 'Node JS' },
      vacancy_skill:   { skill_id: 'SK-ENG-002', skill_label: 'Node.js / Backend Development' }
    )

    expect(result).to eq('match')
  end

  it 'does not match two different catalog codes just because the labels are the same' do
    result = compare(
      portfolio_skill: { skill_id: 'SK-ENG-001', skill_label: 'Node.js / Backend Development' },
      vacancy_skill:   { skill_id: 'SK-ENG-002', skill_label: 'Node.js / Backend Development' }
    )

    expect(result).to eq('not_assessed')
  end

  it 'falls back to the label only for a skill that has no catalog code' do
    result = compare(
      portfolio_skill: { skill_id: nil, skill_label: 'Komunikasi Tim' },
      vacancy_skill:   { skill_id: nil, skill_label: 'komunikasi tim' }
    )

    expect(result).to eq('match')
  end

  it 'reports not assessed when neither the code nor the label match' do
    result = compare(
      portfolio_skill: { skill_id: 'SK-ENG-001', skill_label: 'React' },
      vacancy_skill:   { skill_id: 'SK-ENG-002', skill_label: 'Node.js / Backend Development' }
    )

    expect(result).to eq('not_assessed')
  end
end
