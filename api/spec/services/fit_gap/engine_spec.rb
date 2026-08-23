# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :model do
  let(:portfolio) { create(:portfolio, :complete) }
  let(:vacancy) { create(:vacancy, :with_skills, tenant_id: 1) }
  let(:mock_client) { instance_double(Gemini::HttpClient) }
  let(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_client) }

  before do
    with_tenant
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 3, skill_id: 'SK-ENG-001')
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'React', expected_level: 3, skill_id: 'SK-ENG-001')
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'Node.js', expected_level: 4, skill_id: 'SK-ENG-002')
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'TypeScript', expected_level: 3, skill_id: 'SK-ENG-003')
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'TypeScript', ai_level: 4, skill_id: 'SK-ENG-003')
  end

  describe '#call' do
    let(:mock_response) do
      {
        'culture_narrative' => 'Good culture fit.',
        'overall_narrative' => 'Strong candidate.'
      }
    end

    before do
      allow(mock_client).to receive(:generate_content).and_return(mock_response)
    end

    it 'creates a FitGapReport' do
      expect { engine.call }.to change(FitGapReport, :count).by(1)
    end

    it 'returns the report' do
      report = engine.call
      expect(report).to be_a(FitGapReport)
      expect(report.portfolio).to eq(portfolio)
      expect(report.vacancy).to eq(vacancy)
    end

    it 'builds skill comparisons' do
      report = engine.call
      expect(report.skill_comparisons).to be_present
    end

    it 'stores narratives' do
      report = engine.call
      expect(report.culture_narrative).to eq('Good culture fit.')
      expect(report.overall_narrative).to eq('Strong candidate.')
    end
  end

  describe '#build_skill_comparisons' do
    it 'matches skills by skill_id first' do
      comparisons = engine.send(:build_skill_comparisons)
      react = comparisons.find { |c| c[:skill_label] == 'React' }
      expect(react[:candidate_level]).to eq(3)
      expect(react[:expected_level]).to eq(3)
      expect(react[:result]).to eq('match')
    end

    it 'falls back to label matching when skill_id missing' do
      comparisons = engine.send(:build_skill_comparisons)
      ts = comparisons.find { |c| c[:skill_label] == 'TypeScript' }
      expect(ts[:candidate_level]).to eq(4)
      expect(ts[:result]).to eq('exceed')
    end

    it 'calculates delta and result correctly' do
      comparisons = engine.send(:build_skill_comparisons)
      node = comparisons.find { |c| c[:skill_label] == 'Node.js' }
      expect(node[:candidate_level]).to be_nil
      expect(node[:expected_level]).to eq(4)
      expect(node[:result]).to eq('not_assessed')
    end
  end

  describe '#effective_portfolio_skills' do
    let!(:override) { create(:assessor_override, portfolio_skill: portfolio.portfolio_skills.first, override_level: 5) }

    it 'applies overrides' do
      skills = engine.send(:effective_portfolio_skills)
      react = skills.find { |s| s[:skill_label] == 'React' }
      expect(react[:effective_level]).to eq(5)
      expect(react[:overridden]).to be true
    end
  end

  describe '#generate_narratives' do
    it 'calls Gemini client' do
      expect(mock_client).to receive(:generate_content).and_return({
        'culture_narrative' => 'Culture fit.',
        'overall_narrative' => 'Overall fit.'
      })
      engine.call
    end

    it 'falls back on API error' do
      allow(mock_client).to receive(:generate_content).and_raise(StandardError.new('API down'))
      report = engine.call
      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include('skill matches')
    end
  end
end