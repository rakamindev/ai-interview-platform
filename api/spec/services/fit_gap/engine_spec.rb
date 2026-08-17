# frozen_string_literal: true

require_relative '../../spec_helper'
require_relative '../../../app/services/fit_gap/engine'

RSpec.describe FitGap::Engine do
  FakeRelation = Class.new(Array) do
    def includes(*) = self
  end
  VacancySkill = Struct.new(:skill_label, :skill_id, :expected_level, keyword_init: true)
  PortfolioSkill = Struct.new(
    :id,
    :skill_id,
    :skill_label,
    :ai_level,
    :ai_confidence,
    :assessor_override,
    :evidence_quotes,
    keyword_init: true
  )

  let(:assessment) { instance_double('Assessment') }
  let(:session) { instance_double('Session', tenant_id: 11, assessment: assessment) }
  let(:portfolio_skills) do
    FakeRelation.new([
      PortfolioSkill.new(
        id: 1,
        skill_id: 'system-design',
        skill_label: 'System Design',
        ai_level: 2,
        ai_confidence: 'low',
        assessor_override: instance_double('AssessorOverride', override_level: 3),
        evidence_quotes: ['I started with failure modes']
      )
    ])
  end
  let(:portfolio) do
    instance_double(
      'Portfolio',
      id: 21,
      session: session,
      portfolio_skills: portfolio_skills
    )
  end
  let(:vacancy_skills) do
    FakeRelation.new([
      VacancySkill.new(
        skill_label: 'System Design',
        skill_id: 'system-design',
        expected_level: 3
      ),
      VacancySkill.new(
        skill_label: 'Security',
        skill_id: 'security',
        expected_level: 2
      )
    ])
  end
  let(:vacancy) do
    instance_double(
      'Vacancy',
      id: 31,
      tenant_id: 11,
      vacancy_skills: vacancy_skills,
      role_title: 'Senior Product Engineer',
      culture_dimensions: nil,
      competency_expectations: nil
    )
  end
  let(:client) { instance_double('GeminiClient') }
  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: client) }

  describe 'skill comparisons' do
    it 'preserves override provenance, confidence, and evidence count' do
      comparison = engine.send(:build_skill_comparisons).first

      expect(comparison).to include(
        required_level: 3,
        candidate_level: 3,
        result: 'match',
        confidence: 'low',
        is_override: true,
        evidence_count: 1
      )
    end

    it 'marks missing interview evidence as not assessed instead of a gap' do
      comparison = engine.send(:build_skill_comparisons).last

      expect(comparison).to include(
        skill_label: 'Security',
        required_level: 2,
        candidate_level: nil,
        result: 'not_assessed',
        delta: nil,
        evidence_count: 0
      )
    end
  end

  describe 'failure paths' do
    it 'uses a deterministic, review-safe narrative when the model call fails' do
      allow(client).to receive(:generate_content).and_raise(Timeout::Error)

      comparisons = engine.send(:build_skill_comparisons)
      narratives = engine.send(:generate_narratives, comparisons)

      expect(narratives[:culture]).to be_nil
      expect(narratives[:overall]).to include('Human review is required')
      expect(narratives[:overall]).to include('not assessed')
      expect(narratives[:overall]).to include('low confidence')
    end

    it 'rejects cross-tenant portfolio and vacancy inputs before processing' do
      cross_tenant_vacancy = instance_double('Vacancy', tenant_id: 99)
      unsafe_engine = described_class.new(
        portfolio: portfolio,
        vacancy: cross_tenant_vacancy,
        gemini_client: client
      )

      expect { unsafe_engine.call }
        .to raise_error(ArgumentError, 'Portfolio and vacancy must belong to the same tenant')
    end
  end
end
