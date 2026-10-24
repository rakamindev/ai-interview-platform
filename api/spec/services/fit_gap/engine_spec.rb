# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  subject(:report) do
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client).call
  end

  let(:gemini_client) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'culture_narrative' => 'Culture fit narrative.',
        'overall_narrative' => 'Overall fit narrative.'
      }
    )
  end
  let(:portfolio) { create(:portfolio) }
  let(:vacancy) { create(:vacancy) }

  it 'emits the expected level and flags skills without an override' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 2)

    expect(report.skill_comparisons.first).to include(
      'expected_level' => 3,
      'candidate_level' => 2,
      'delta' => -1,
      'result' => 'gap',
      'is_override' => false
    )
  end

  it 'uses the override level and flags the comparison as overridden' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
    skill = create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 2)
    create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 4)

    expect(report.skill_comparisons.first).to include(
      'candidate_level' => 4,
      'delta' => 1,
      'result' => 'exceed',
      'is_override' => true
    )
  end

  it 'marks missing skills as not assessed without an override flag' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'Kubernetes', expected_level: 4)

    expect(report.skill_comparisons.first).to include(
      'expected_level' => 4,
      'candidate_level' => nil,
      'result' => 'not_assessed',
      'is_override' => false
    )
  end

  it 'matches by skill id even when the stored id differs in case' do
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'SK-ENG-001', skill_label: 'Vacancy label', expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-eng-001', skill_label: 'Portfolio label', ai_level: 3)

    expect(report.skill_comparisons.first).to include(
      'candidate_level' => 3,
      'result' => 'match'
    )
  end

  context 'when the narrative model call fails' do
    let(:gemini_client) { instance_double(Gemini::HttpClient) }

    before do
      allow(gemini_client).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::ApiError, 'API returned 500')
    end

    it 'still persists the report with a rule-based fallback narrative' do
      create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3)

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include('1 skill matches')
      expect(report.skill_comparisons.first).to include('result' => 'match')
    end
  end

  it 'reuses the existing report on re-generation (duplicate job)' do
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 2)

    first = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client).call
    second = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client).call

    expect(second.id).to eq(first.id)
    expect(FitGapReport.where(portfolio_id: portfolio.id).count).to eq(1)
  end
end
