# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:session) { create(:session) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, tenant_id: session.tenant_id) }
  let(:gemini) { instance_double(Gemini::HttpClient) }

  before do
    allow(gemini).to receive(:generate_content).and_return(
      { 'culture_narrative' => 'Good collaboration signals.', 'overall_narrative' => 'Strong overall fit.' }
    )
  end

  it 'classifies matching, gap, exceeding and unassessed skills' do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'ruby', skill_label: 'Ruby', ai_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'sql', skill_label: 'SQL', ai_level: 2)
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'rails', skill_label: 'Rails', ai_level: 5)

    create(:vacancy_skill, vacancy: vacancy, skill_id: 'ruby', skill_label: 'Ruby', expected_level: 3)
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'sql', skill_label: 'SQL', expected_level: 4)
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'rails', skill_label: 'Rails', expected_level: 3)
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'docker', skill_label: 'Docker', expected_level: 2)

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call

    results = report.skill_comparisons.index_by { |item| item['skill_label'] }
    expect(results['Ruby']['result']).to eq('match')
    expect(results['SQL']['result']).to eq('gap')
    expect(results['Rails']['result']).to eq('exceed')
    expect(results['Docker']['result']).to eq('not_assessed')
    expect(report.culture_narrative).to eq('Good collaboration signals.')
    expect(report.overall_narrative).to eq('Strong overall fit.')
  end

  it 'uses the assessor override instead of the AI level' do
    skill = create(:portfolio_skill, portfolio: portfolio, skill_id: 'ruby', skill_label: 'Ruby', ai_level: 2)
    create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 4)
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'ruby', skill_label: 'Ruby', expected_level: 4)

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call

    expect(report.skill_comparisons.first['candidate_level']).to eq(4)
    expect(report.skill_comparisons.first['result']).to eq('match')
  end

  it 'falls back to deterministic narrative when Gemini fails' do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'ruby', skill_label: 'Ruby', ai_level: 2)
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'ruby', skill_label: 'Ruby', expected_level: 4)
    allow(gemini).to receive(:generate_content).and_raise(StandardError, 'provider unavailable')

    report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call

    expect(report.culture_narrative).to be_nil
    expect(report.overall_narrative).to include('0 skill matches, 0 exceeds, and 1 gaps')
  end

  it 'updates the existing report instead of creating a duplicate' do
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'ruby', skill_label: 'Ruby', expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'ruby', skill_label: 'Ruby', ai_level: 3)

    2.times { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini).call }

    expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
  end
end
