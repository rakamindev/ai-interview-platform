# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:org) { set_current_tenant }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, tenant_id: org.id, role_title: 'Senior Fullstack Engineer') }

  let!(:skill_ruby) do
    create(:portfolio_skill,
           portfolio: portfolio,
           skill_id: 'sk-ruby',
           skill_label: 'Ruby on Rails',
           ai_level: 3,
           ai_confidence: 'high')
  end

  let!(:skill_react) do
    create(:portfolio_skill,
           portfolio: portfolio,
           skill_id: 'sk-react',
           skill_label: 'React Architecture',
           ai_level: 4,
           ai_confidence: 'high')
  end

  let!(:skill_sql) do
    create(:portfolio_skill,
           portfolio: portfolio,
           skill_id: 'sk-sql',
           skill_label: 'PostgreSQL Database Tuning',
           ai_level: 2,
           ai_confidence: 'medium')
  end

  let!(:vac_ruby) { create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-ruby', skill_label: 'Ruby on Rails', expected_level: 3) }
  let!(:vac_react) { create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-react', skill_label: 'React Architecture', expected_level: 3) }
  let!(:vac_sql) { create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-sql', skill_label: 'PostgreSQL Database Tuning', expected_level: 4) }
  let!(:vac_docker) { create(:vacancy_skill, vacancy: vacancy, skill_id: 'sk-docker', skill_label: 'Docker & Kubernetes', expected_level: 3) }

  describe '#call' do
    let(:mock_gemini) { instance_double(Gemini::HttpClient) }

    before do
      allow(mock_gemini).to receive(:generate_content).and_return(
        {
          'culture_narrative' => 'Candidate shows strong alignment with technical standards.',
          'overall_narrative' => 'Recommended for next interview stage.'
        }.to_json
      )
    end

    it 'correctly calculates match, exceed, gap, and not_assessed' do
      engine = described_entry = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      expect(report).to be_persisted
      comparisons = report.skill_comparisons.index_by { |c| c['skill_id'] }

      # Match: Ruby (candidate L3 vs required L3 => delta 0)
      ruby_comp = comparisons['sk-ruby']
      expect(ruby_comp['result']).to eq('match')
      expect(ruby_comp['delta']).to eq(0)
      expect(ruby_comp['is_override']).to be false

      # Exceed: React (candidate L4 vs required L3 => delta +1)
      react_comp = comparisons['sk-react']
      expect(react_comp['result']).to eq('exceed')
      expect(react_comp['delta']).to eq(1)
      expect(react_comp['is_override']).to be false

      # Gap: SQL (candidate L2 vs required L4 => delta -2)
      sql_comp = comparisons['sk-sql']
      expect(sql_comp['result']).to eq('gap')
      expect(sql_comp['delta']).to eq(-2)
      expect(sql_comp['is_override']).to be false

      # Not Assessed: Docker (candidate has no score => not_assessed, delta nil)
      docker_comp = comparisons['sk-docker']
      expect(docker_comp['result']).to eq('not_assessed')
      expect(docker_comp['delta']).to be_nil
      expect(docker_comp['candidate_level']).to be_nil
      expect(docker_comp['is_override']).to be false
    end

    it 'prioritizes human assessor overrides over AI score' do
      create(:assessor_override,
             portfolio_skill: skill_sql,
             ai_level: 2,
             override_level: 4,
             assessor_notes: 'Demonstrated deep Postgres index knowledge in turn 15.')

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      comparisons = report.skill_comparisons.index_by { |c| c['skill_id'] }
      sql_comp = comparisons['sk-sql']

      # With override to L4, SQL should now be match (delta 0) instead of gap
      expect(sql_comp['candidate_level']).to eq(4)
      expect(sql_comp['result']).to eq('match')
      expect(sql_comp['delta']).to eq(0)
      expect(sql_comp['is_override']).to be true
    end

    it 'falls back gracefully when Gemini LLM raises an error' do
      allow(mock_gemini).to receive(:generate_content).and_raise(StandardError.new('Gemini 503 Service Unavailable'))

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      expect(report).to be_persisted
      expect(report.culture_narrative).to be_present
      expect(report.overall_narrative).to include('Candidate shows')
    end
  end
end
