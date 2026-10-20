# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:organization) { Organization.create!(name: 'FitGap Org', scheme: 'fitgap', identifier: 'fitgap', host: 'fitgap.test') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Senior Backend Engineer',
      time_limit_min: 30
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: organization.id,
      assessment: assessment,
      invite_token: SecureRandom.hex(16),
      status: :ended
    )
  end
  let(:portfolio) { Portfolio.create!(session: session, generation_status: 'complete') }
  let(:vacancy) do
    Vacancy.create!(
      tenant_id: organization.id,
      created_by: 1,
      role_title: 'Senior Backend Engineer'
    )
  end
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }

  before do
    allow(mock_gemini_client).to receive(:generate_content).and_return({
      'culture_narrative' => 'Strong team fit.',
      'overall_narrative' => 'Recommended candidate.'
    }.to_json)
  end

  describe '#call' do
    it 'handles skills with nil ai_level without raising NoMethodError on nil arithmetic' do
      # Vacancy expects Ruby L3 and Docker L3
      vacancy.vacancy_skills.create!(skill_label: 'Ruby', expected_level: 3)
      vacancy.vacancy_skills.create!(skill_label: 'Docker', expected_level: 3)

      # Candidate has Ruby L4 (assessed) and Docker with nil ai_level (unassessed)
      portfolio.portfolio_skills.create!(
        skill_label: 'Ruby',
        ai_level: 4,
        ai_confidence: 'high',
        competency_summary: 'Expert in Ruby'
      )
      portfolio.portfolio_skills.create!(
        skill_label: 'Docker',
        ai_level: nil,
        ai_confidence: nil,
        competency_summary: 'Unassessed'
      )

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client)
      
      expect { engine.call }.not_to raise_error

      report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
      comparisons = report.skill_comparisons

      ruby_comparison = comparisons.find { |c| c['skill_label'] == 'Ruby' }
      expect(ruby_comparison['result']).to eq('exceed')
      expect(ruby_comparison['delta']).to eq(1)

      docker_comparison = comparisons.find { |c| c['skill_label'] == 'Docker' }
      expect(docker_comparison['result']).to eq('not_assessed')
      expect(docker_comparison['candidate_level']).to be_nil
      expect(docker_comparison['delta']).to be_nil
    end

    it 'handles completely missing portfolio skills as not_assessed' do
      vacancy.vacancy_skills.create!(skill_label: 'Kubernetes', expected_level: 4)

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client)
      report = engine.call
      k8s = report.skill_comparisons.find { |c| c['skill_label'] == 'Kubernetes' }

      expect(k8s['result']).to eq('not_assessed')
      expect(k8s['candidate_level']).to be_nil
      expect(k8s['delta']).to be_nil
    end

    it 'ingests discovered skills in narrative prompt and exposes discovered_skills on report' do
      vacancy.vacancy_skills.create!(skill_label: 'Ruby', expected_level: 3)
      portfolio.portfolio_skills.create!(
        skill_label: 'Ruby',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Proficient in Ruby'
      )
      portfolio.portfolio_skills.create!(
        skill_label: 'Kafka Streaming',
        is_discovered: true,
        ai_level: 4,
        ai_confidence: 'medium',
        competency_summary: 'Built production event streaming pipelines'
      )

      received_prompt = nil
      allow(mock_gemini_client).to receive(:generate_content) do |prompt, **_kwargs|
        received_prompt = prompt
        { 'culture_narrative' => 'Strong fit', 'overall_narrative' => 'Hire' }.to_json
      end

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client)
      report = engine.call

      expect(received_prompt).to include('Discovered candidate strengths (1): Kafka Streaming (L4)')
      expect(report.discovered_skills.count).to eq(1)
      discovered = report.discovered_skills.first
      expect(discovered[:skill_label]).to eq('Kafka Streaming')
      expect(discovered[:candidate_level]).to eq(4)
    end

    it 'includes unassessed skills count in fallback narrative when Gemini generation fails' do
      vacancy.vacancy_skills.create!(skill_label: 'PostgreSQL', expected_level: 3)
      vacancy.vacancy_skills.create!(skill_label: 'Redis', expected_level: 3)

      portfolio.portfolio_skills.create!(
        skill_label: 'PostgreSQL',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Match'
      )

      allow(mock_gemini_client).to receive(:generate_content).and_raise(StandardError.new('Gemini timeout'))

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client)
      report = engine.call

      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include('1 skill was not assessed during this session and require follow-up evaluation.')
    end

    it 'matches custom vacancy skills using normalized label matching with overrides support' do
      # Custom vacancy skill with irregular casing and leading/trailing whitespace
      custom_v_skill = vacancy.vacancy_skills.create!(
        skill_id: nil,
        skill_label: '  Golang Concurrency  ',
        expected_level: 3,
        is_custom: true
      )

      # Candidate portfolio skill discovered or evaluated with different casing
      p_skill = portfolio.portfolio_skills.create!(
        skill_id: nil,
        skill_label: 'golang concurrency',
        ai_level: 2,
        ai_confidence: 'medium',
        competency_summary: 'Basic goroutines usage',
        is_discovered: false
      )

      # Assessor overrides candidate to level 4
      p_skill.create_assessor_override!(
        ai_level: 2,
        override_level: 4,
        assessor_notes: 'Demonstrated channel synchronization and worker pools',
        overridden_by: 42
      )

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini_client)
      report = engine.call

      comparison = report.skill_comparisons.find { |c| c['skill_label'] == '  Golang Concurrency  ' }
      expect(comparison).to be_present
      expect(comparison['is_custom']).to be true
      expect(comparison['candidate_level']).to eq(4)
      expect(comparison['expected_level']).to eq(3)
      expect(comparison['delta']).to eq(1)
      expect(comparison['result']).to eq('exceed')
      expect(comparison['overridden']).to be true
    end

    it 'injects vacancy organization tenant into Gemini::HttpClient' do
      mock_client = instance_double(Gemini::HttpClient)
      expect(Gemini::HttpClient).to receive(:new).with(
        hash_including(
          organization: organization
        )
      ).and_return(mock_client)

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy)
      expect(engine.instance_variable_get(:@gemini_client)).to eq(mock_client)
    end
  end
end
