# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }
  let(:session_record) { create(:session, :ended, assessment: assessment) }
  let(:portfolio) { create(:portfolio, session: session_record) }
  let(:vacancy) { create(:vacancy, tenant_id: organization.id) }

  let(:mock_gemini) do
    double('Gemini::HttpClient', generate_content: {
      'culture_narrative' => 'Strong cultural alignment with collaborative engineering mindset.',
      'overall_narrative' => 'Recommended for senior backend hiring.'
    })
  end

  before do
    Current.organization = organization
    Current.tenant_id = organization.id
  end

  describe 'Skill comparison classifications (Positive)' do
    it 'correctly classifies match, exceed, and gap' do
      # Match: expected 3, candidate 3
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'RUBY', skill_label: 'Ruby on Rails', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'RUBY', skill_label: 'Ruby on Rails', ai_level: 3)

      # Exceed: expected 2, candidate 4
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'POSTGRES', skill_label: 'PostgreSQL', expected_level: 2)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'POSTGRES', skill_label: 'PostgreSQL', ai_level: 4)

      # Gap: expected 4, candidate 2
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'SYSTEM_DESIGN', skill_label: 'System Design', expected_level: 4)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SYSTEM_DESIGN', skill_label: 'System Design', ai_level: 2)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini).call
      comps = report.comparisons

      ruby_comp = comps.find { |c| c[:skill_id] == 'RUBY' }
      expect(ruby_comp[:result]).to eq('match')
      expect(ruby_comp[:delta]).to eq(0)
      expect(ruby_comp[:candidate_level]).to eq(3)

      pg_comp = comps.find { |c| c[:skill_id] == 'POSTGRES' }
      expect(pg_comp[:result]).to eq('exceed')
      expect(pg_comp[:delta]).to eq(2)

      sys_comp = comps.find { |c| c[:skill_id] == 'SYSTEM_DESIGN' }
      expect(sys_comp[:result]).to eq('gap')
      expect(sys_comp[:delta]).to eq(-2)

      # Summary verification
      summary = report.summary
      expect(summary[:match_count]).to eq(1)
      expect(summary[:exceed_count]).to eq(1)
      expect(summary[:gap_count]).to eq(1)
      expect(summary[:not_assessed_count]).to eq(0)
      # fit_percentage = (1 match + 1 exceed) / 3 * 100 = 66.7%
      expect(summary[:fit_percentage]).to eq(66.7)
    end

    it 'respects assessor override levels over ai levels' do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'GO', skill_label: 'Golang', expected_level: 4)
      skill = create(:portfolio_skill, portfolio: portfolio, skill_id: 'GO', skill_label: 'Golang', ai_level: 2)
      create(:assessor_override, portfolio_skill: skill, override_level: 5)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini).call
      go_comp = report.comparisons.find { |c| c[:skill_id] == 'GO' }

      expect(go_comp[:result]).to eq('exceed')
      expect(go_comp[:candidate_level]).to eq(5)
      expect(go_comp[:delta]).to eq(1)
    end
  end

  describe 'Unassessed skills & Edge cases' do
    it 'handles unassessed skills with nil level without crashing delta arithmetic' do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'K8S', skill_label: 'Kubernetes', expected_level: 3)
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'DOCKER', skill_label: 'Docker', expected_level: 3)

      create(:portfolio_skill, portfolio: portfolio, skill_id: 'DOCKER', skill_label: 'Docker', ai_level: 3)

      # Simulate a portfolio skill record where effective_level resolved to nil
      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      allow(engine).to receive(:effective_portfolio_skills).and_return([
        {
          id: 999,
          skill_id: 'K8S',
          skill_label: 'Kubernetes',
          ai_level: nil,
          effective_level: nil,
          confidence: nil,
          overridden: false
        },
        {
          id: 1000,
          skill_id: 'DOCKER',
          skill_label: 'Docker',
          ai_level: 3,
          effective_level: 3,
          confidence: 'high',
          overridden: false
        }
      ])

      report = engine.call
      comps = report.comparisons

      k8s_comp = comps.find { |c| c[:skill_id] == 'K8S' }
      expect(k8s_comp[:result]).to eq('not_assessed')
      expect(k8s_comp[:delta]).to be_nil
      expect(k8s_comp[:candidate_level]).to be_nil

      # Summary should NOT penalize K8S in the denominator
      summary = report.summary
      expect(summary[:match_count]).to eq(1)
      expect(summary[:not_assessed_count]).to eq(1)
      # Denominator is 1 (only Docker assessed); fit percentage is 100.0%
      expect(summary[:fit_percentage]).to eq(100.0)
    end

    it 'marks vacancy skill as not_assessed when completely missing from candidate portfolio' do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'AWS', skill_label: 'AWS Cloud', expected_level: 3)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini).call
      aws_comp = report.comparisons.find { |c| c[:skill_id] == 'AWS' }

      expect(aws_comp[:result]).to eq('not_assessed')
      expect(aws_comp[:delta]).to be_nil
      expect(aws_comp[:candidate_level]).to be_nil
      expect(report.summary[:not_assessed_count]).to eq(1)
      expect(report.summary[:fit_percentage]).to eq(0.0)
    end
  end

  describe 'Negative & Resilient fallbacks' do
    it 'falls back cleanly to deterministic template narrative when Gemini fails' do
      failing_gemini = double('Gemini::HttpClient')
      allow(failing_gemini).to receive(:generate_content).and_raise(StandardError, 'Gemini quota exceeded')

      create(:vacancy_skill, vacancy: vacancy, skill_id: 'RUBY', skill_label: 'Ruby', expected_level: 3)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'RUBY', skill_label: 'Ruby', ai_level: 3)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: failing_gemini).call

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to eq('Candidate shows 1 skill matches, 0 exceeds, and 0 gaps against role requirements.')
    end
  end

  describe 'Monkey / Fuzzing tests' do
    it 'handles vacancy with zero required skills without dividing by zero' do
      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini).call

      expect(report.comparisons).to eq([])
      expect(report.summary[:fit_percentage]).to eq(0.0)
      expect(report.summary[:match_count]).to eq(0)
    end

    it 'handles portfolio with duplicate skill IDs or case-variant labels gracefully' do
      create(:vacancy_skill, vacancy: vacancy, skill_id: 'REACT', skill_label: 'ReactJS', expected_level: 3)

      create(:portfolio_skill, portfolio: portfolio, skill_id: 'REACT', skill_label: 'reactjs', ai_level: 4)
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'REACT', skill_label: 'ReactJS', ai_level: 5)

      report = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini).call
      react_comp = report.comparisons.find { |c| c[:skill_id] == 'REACT' }

      expect(react_comp).to be_present
      expect(%w[match exceed]).to include(react_comp[:result])
    end
  end
end
