# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  let(:tenant) do
    Organization.first || Organization.create!(
      name: 'Rakamin Spec',
      scheme: 'rakamin_spec',
      identifier: 'rakamin-spec',
      host: 'spec.rakamin.com'
    )
  end

  let(:vacancy) do
    v = Vacancy.create!(
      tenant_id: tenant.id,
      created_by: 1,
      role_title: 'Lead Fullstack Developer'
    )
    v.vacancy_skills.create!(skill_label: 'Ruby on Rails', expected_level: 4)
    v.vacancy_skills.create!(skill_label: 'React', expected_level: 3)
    v.vacancy_skills.create!(skill_label: 'System Design', expected_level: 5)
    v.vacancy_skills.create!(skill_label: 'Docker & Kubernetes', expected_level: 3)
    v
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id: tenant.id,
      created_by: 1,
      name: 'Fullstack Assessment',
      time_limit_min: 45,
      vacancy: vacancy
    )
  end

  let(:session) do
    Session.create!(
      tenant_id: tenant.id,
      assessment: assessment,
      candidate_name: 'Budi Pratama',
      status: 'ended',
      end_reason: 'manual_candidate'
    )
  end

  let(:portfolio) do
    p = Portfolio.create!(
      tenant_id: tenant.id,
      session: session,
      generation_status: 'complete'
    )
    # Rails: match (L4 == L4)
    p.portfolio_skills.create!(
      tenant_id: tenant.id,
      skill_label: 'Ruby on Rails',
      ai_level: 4,
      ai_confidence: 'high',
      competency_summary: 'Experienced with Rails 7.'
    )
    # React: exceed (L4 > L3)
    p.portfolio_skills.create!(
      tenant_id: tenant.id,
      skill_label: 'React',
      ai_level: 4,
      ai_confidence: 'medium',
      competency_summary: 'Solid React & TypeScript skills.'
    )
    # System Design: gap (L3 < L5)
    p.portfolio_skills.create!(
      tenant_id: tenant.id,
      skill_label: 'System Design',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Solid architectural basics, needs scaling experience.'
    )
    # Docker: not in portfolio -> will be 'not_assessed'
    p
  end

  before do
    Current.organization = tenant
    Current.tenant_id = tenant.id
  end

  after do
    Current.clear
  end

  describe '#call' do
    it 'accurately evaluates skill match, exceed, gap, and not_assessed' do
      # Stub gemini client narrative generation to avoid external HTTP call
      fake_client = double('GeminiClient')
      allow(fake_client).to receive(:instance_variable_get).with(:@model).and_return('gemini-3.6-flash')
      allow(fake_client).to receive(:generate_content).and_return(
        {
          'culture_narrative' => 'Strong competency match for senior responsibilities.',
          'overall_narrative' => 'Recommended for further interview stage.'
        }.to_json
      )

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client)
      report = engine.call

      expect(report).to be_persisted
      expect(report.portfolio_id).to eq(portfolio.id)
      expect(report.vacancy_id).to eq(vacancy.id)

      comps = report.skill_comparisons.index_by { |c| c['skill_label'] }

      # Rails: candidate 4, expected 4 -> match (delta: 0)
      rails_comp = comps['Ruby on Rails']
      expect(rails_comp['candidate_level']).to eq(4)
      expect(rails_comp['expected_level']).to eq(4)
      expect(rails_comp['result']).to eq('match')
      expect(rails_comp['delta']).to eq(0)

      # React: candidate 4, expected 3 -> exceed (delta: 1)
      react_comp = comps['React']
      expect(react_comp['candidate_level']).to eq(4)
      expect(react_comp['expected_level']).to eq(3)
      expect(react_comp['result']).to eq('exceed')
      expect(react_comp['delta']).to eq(1)

      # System Design: candidate 3, expected 5 -> gap (delta: -2)
      sd_comp = comps['System Design']
      expect(sd_comp['candidate_level']).to eq(3)
      expect(sd_comp['expected_level']).to eq(5)
      expect(sd_comp['result']).to eq('gap')
      expect(sd_comp['delta']).to eq(-2)

      # Docker: not assessed
      docker_comp = comps['Docker & Kubernetes']
      expect(docker_comp['candidate_level']).to be_nil
      expect(docker_comp['result']).to eq('not_assessed')
      expect(docker_comp['delta']).to be_nil
    end

    it 'applies assessor overrides to candidate level and recalculates result' do
      fake_client = double('GeminiClient')
      allow(fake_client).to receive(:instance_variable_get).with(:@model).and_return('gemini-3.6-flash')
      allow(fake_client).to receive(:generate_content).and_return(
        { 'culture_narrative' => 'Good fit.', 'overall_narrative' => 'Approved.' }.to_json
      )

      # Add an assessor override on System Design from L3 to L5 (turning gap into match!)
      sd_skill = portfolio.portfolio_skills.find_by(skill_label: 'System Design')
      AssessorOverride.create!(
        portfolio_skill_id: sd_skill.id,
        ai_level: sd_skill.ai_level,
        override_level: 5,
        overridden_by: 1,
        assessor_notes: 'Demonstrated deep microservices understanding in portfolio review.'
      )

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_client)
      report = engine.call

      comps = report.skill_comparisons.index_by { |c| c['skill_label'] }
      sd_comp = comps['System Design']

      expect(sd_comp['candidate_level']).to eq(5)
      expect(sd_comp['is_override']).to be true
      expect(sd_comp['result']).to eq('match')
      expect(sd_comp['delta']).to eq(0)
    end
  end
end
