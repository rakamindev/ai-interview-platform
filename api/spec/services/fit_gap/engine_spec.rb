# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session_record) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: session_record) }
  let(:vacancy) { create(:vacancy, tenant_id: org.id) }

  let!(:vacancy_skill1) do
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-1', skill_label: 'Ruby on Rails', expected_level: 3)
  end
  let!(:vacancy_skill2) do
    create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-2', skill_label: 'PostgreSQL', expected_level: 4)
  end

  let!(:portfolio_skill1) do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-1', skill_label: 'Ruby on Rails', ai_level: 3)
  end
  let!(:portfolio_skill2) do
    create(:portfolio_skill, portfolio: portfolio, skill_id: 'sk-2', skill_label: 'PostgreSQL', ai_level: 2)
  end

  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  before do
    allow(mock_gemini).to receive(:generate_content).and_return({
      'culture_narrative' => 'Strong collaborative mindset.',
      'overall_narrative' => 'Recommended for mid-level position.'
    })
  end

  it 'calculates skill level comparisons and classifies results' do
    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    report = engine.call

    comparisons = report.skill_comparisons.map(&:deep_symbolize_keys)

    rails_comp = comparisons.find { |c| c[:skill_id] == 'sk-1' }
    expect(rails_comp[:result]).to eq('match')
    expect(rails_comp[:delta]).to eq(0)

    pg_comp = comparisons.find { |c| c[:skill_id] == 'sk-2' }
    expect(pg_comp[:result]).to eq('gap')
    expect(pg_comp[:delta]).to eq(-2)
  end

  it 'emits both required_level and expected_level, and is_override in comparison payload' do
    # Add override on portfolio_skill1
    AssessorOverride.create!(
      portfolio_skill: portfolio_skill1,
      ai_level: 3,
      override_level: 4,
      overridden_by: 1
    )

    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    report = engine.call

    comparisons = report.skill_comparisons.map(&:deep_symbolize_keys)
    rails_comp = comparisons.find { |c| c[:skill_id] == 'sk-1' }

    expect(rails_comp).to have_key(:required_level)
    expect(rails_comp).to have_key(:expected_level)
    expect(rails_comp[:required_level]).to eq(3)
    expect(rails_comp[:expected_level]).to eq(3)
    expect(rails_comp[:candidate_level]).to eq(4) # overridden
    expect(rails_comp[:is_override]).to be true

    pg_comp = comparisons.find { |c| c[:skill_id] == 'sk-2' }
    expect(pg_comp[:is_override]).to be false
  end

  it 'includes discovered skills in comparison list with exceed status' do
    create(
      :portfolio_skill,
      portfolio: portfolio,
      skill_id: nil,
      skill_label: 'Docker',
      is_discovered: true,
      ai_level: 4,
      ai_confidence: 'high'
    )

    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    report = engine.call

    comparisons = report.skill_comparisons.map(&:deep_symbolize_keys)
    docker_comp = comparisons.find { |c| c[:skill_label] == 'Docker' }

    expect(docker_comp).not_to be_nil
    expect(docker_comp[:result]).to eq('exceed')
    expect(docker_comp[:candidate_level]).to eq(4)
    expect(docker_comp[:required_level]).to be_nil
    expect(docker_comp[:expected_level]).to be_nil
  end

  it 'passes top verbatim evidence quotes and competency summaries into narrative prompt' do
    portfolio_skill1.update!(
      evidence: ['Quote 1: Built ActiveRecord models', 'Quote 2: Optimized query execution', 'Quote 3: Should not include 3rd'],
      competency_summary: 'Demonstrates Rails mastery.'
    )

    prompt_captured = nil
    allow(mock_gemini).to receive(:generate_content) do |prompt, **_args|
      prompt_captured = prompt
      {
        'culture_narrative' => 'Strong collaborative mindset.',
        'overall_narrative' => 'Recommended for mid-level position.'
      }
    end

    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    engine.call

    expect(prompt_captured).to include('Quote 1: Built ActiveRecord models')
    expect(prompt_captured).to include('Quote 2: Optimized query execution')
    expect(prompt_captured).not_to include('Quote 3: Should not include 3rd')
    expect(prompt_captured).to include('Demonstrates Rails mastery.')
  end

  it 'falls back to deterministic narrative when Gemini client raises an error' do
    allow(mock_gemini).to receive(:generate_content).and_raise(Faraday::TimeoutError.new('timeout'))

    engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
    report = engine.call

    expect(report.culture_narrative).to be_nil
    expect(report.overall_narrative).to eq('Candidate shows 1 skill matches, 0 exceeds, and 1 gaps against role requirements.')
  end
end
