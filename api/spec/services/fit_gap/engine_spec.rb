# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let!(:org) { Organization.create!(name: 'Company A', scheme: 'comp_a', identifier: 'comp_a', host: 'compa.test') }

  let!(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: 1,
      name: 'Fullstack Assessment',
      language: 'id',
      time_limit_min: 10
    )
  end

  let!(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment: assessment,
      status: 'ended'
    )
  end

  let!(:portfolio) do
    Portfolio.create!(
      session: session,
      generation_status: 'complete'
    )
  end

  let!(:skill_1) do
    portfolio.portfolio_skills.create!(
      skill_id: 'sk-01',
      skill_label: 'React / Frontend Development',
      is_discovered: false,
      ai_level: 2,
      ai_confidence: 'high',
      evidence: ['quote 1'],
      competency_summary: 'Good react knowledge.'
    )
  end

  let!(:skill_2) do
    portfolio.portfolio_skills.create!(
      skill_id: 'sk-02',
      skill_label: 'Node.js / Backend Development',
      is_discovered: false,
      ai_level: 3,
      ai_confidence: 'high',
      evidence: ['quote 2'],
      competency_summary: 'Good backend knowledge.'
    )
  end

  # Skill 1 is overridden by human assessor to Level 4
  let!(:override_1) do
    AssessorOverride.create!(
      portfolio_skill: skill_1,
      ai_level: 2,
      override_level: 4,
      assessor_notes: 'Promoted to L4 based on architectural interview.',
      overridden_by: 1,
      overridden_at: Time.current
    )
  end

  let!(:vacancy) do
    v = Vacancy.create!(
      tenant_id: org.id,
      created_by: 1,
      role_title: 'Fullstack Engineer'
    )
    v.vacancy_skills.create!(skill_id: 'sk-01', skill_label: 'React / Frontend Development', expected_level: 3)
    v.vacancy_skills.create!(skill_id: 'sk-02', skill_label: 'Node.js / Backend Development', expected_level: 3)
    v
  end

  let(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy) }

  describe '#build_skill_comparisons (TAMPILAN-01)' do
    it 'includes required_level for frontend compatibility and is_override indicator' do
      comparisons = engine.send(:build_skill_comparisons)

      react_comp = comparisons.find { |c| c[:skill_label] == 'React / Frontend Development' }
      node_comp  = comparisons.find { |c| c[:skill_label] == 'Node.js / Backend Development' }

      expect(react_comp).to be_present
      expect(node_comp).to be_present

      # 1. UI Contract: required_level must be present so table displays required level
      expect(react_comp[:required_level]).to eq(3)
      expect(node_comp[:required_level]).to eq(3)

      # 2. PDF compatibility: expected_level must still be present
      expect(react_comp[:expected_level]).to eq(3)
      expect(node_comp[:expected_level]).to eq(3)

      # 3. Override indicator: react_comp has override -> is_override: true (renders pencil icon)
      expect(react_comp[:is_override]).to be true
      expect(react_comp[:candidate_level]).to eq(4) # Effective overridden level

      # 4. node_comp has NO override -> is_override: false
      expect(node_comp[:is_override]).to be false
      expect(node_comp[:candidate_level]).to eq(3) # AI level
    end
  end

  describe '#generate_narratives (TAMPILAN-02)' do
    let(:mock_gemini) { instance_double(Gemini::HttpClient) }
    let(:engine_with_mock) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini) }
    let(:sample_comparisons) { engine_with_mock.send(:build_skill_comparisons) }

    before do
      # Avoid sleeping during tests
      allow(engine_with_mock).to receive(:sleep)
    end

    it 'returns culture and overall narratives when AI succeeds' do
      expect(mock_gemini).to receive(:generate_content).and_return({
        'culture_narrative' => 'Strong team culture alignment.',
        'overall_narrative' => 'Recommended for the role.'
      })

      narratives = engine_with_mock.send(:generate_narratives, sample_comparisons)
      expect(narratives[:culture]).to eq('Strong team culture alignment.')
      expect(narratives[:overall]).to eq('Recommended for the role.')
    end

    it 'retries up to 2 times on rate limit before falling back to rule-based summary' do
      expect(mock_gemini).to receive(:generate_content).exactly(3).times.and_raise(
        Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429)
      )

      narratives = engine_with_mock.send(:generate_narratives, sample_comparisons)
      expect(narratives[:culture]).to be_nil
      expect(narratives[:overall]).to include('skill match')
    end
  end
end
