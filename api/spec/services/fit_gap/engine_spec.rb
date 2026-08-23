# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy) { create(:vacancy) }
  let!(:vacancy_skill) { create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 4) }
  let!(:portfolio_skill) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3) }

  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  before do
    allow(mock_gemini).to receive(:generate_content).and_return({
      'culture_narrative' => 'Good alignment.',
      'overall_narrative' => 'Strong candidate.'
    })
  end

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini) }

  it 'generates fit/gap report emitting is_override flag correctly' do
    report = engine.call
    comp = report.skill_comparisons.first
    expect(comp['skill_label']).to eq('React')
    expect(comp['expected_level']).to eq(4)
    expect(comp['candidate_level']).to eq(3)
    expect(comp['result']).to eq('gap')
    expect(comp['is_override']).to be false
  end

  it 'emits is_override: true when assessor override exists' do
    create(:assessor_override, portfolio_skill: portfolio_skill, ai_level: 3, override_level: 5)
    report = engine.call
    comp = report.skill_comparisons.first
    expect(comp['candidate_level']).to eq(5)
    expect(comp['result']).to eq('exceed')
    expect(comp['is_override']).to be true
  end
end
