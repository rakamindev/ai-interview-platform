# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler do
  let(:skill) do
    double(
      'AssessmentSkill',
      skill_label: 'PostgreSQL Indexing & Optimization',
      scope_include: 'B-Tree, GIN, query plans, vacuuming',
      scope_exclude: 'Basic CRUD operations',
      l1_anchor: 'Understands primary keys and basic indexing',
      l2_anchor: 'Uses EXPLAIN to inspect query cost',
      l3_anchor: 'Designs composite indexes matching query WHERE clauses',
      l4_anchor: 'Diagnoses index bloat and selects between BTREE and BRIN',
      l5_anchor: 'Architects partition schemes and WAL tuning for high write throughput'
    )
  end

  let(:assessment_skills_relation) { [skill] }
  let(:assessment) do
    double(
      'Assessment',
      language: language,
      assessment_skills: assessment_skills_relation
    )
  end

  before do
    allow(assessment_skills_relation).to receive(:order).with(:display_order).and_return(assessment_skills_relation)
  end

  describe '#call with English language' do
    let(:language) { 'en' }
    subject(:compiler) { described_class.new(assessment) }

    it 'includes English language instructions' do
      prompt = compiler.call

      expect(prompt).to include('Conduct this entire interview in English')
      expect(prompt).to include('ASSESSMENT AGENDA')
      expect(prompt).to include('SKILL: PostgreSQL Indexing & Optimization')
      expect(prompt).to include('L1 — Understands primary keys and basic indexing')
      expect(prompt).to include('L5 — Architects partition schemes and WAL tuning')
      expect(prompt).to include('INTERVIEW RULES')
      expect(prompt).to include('PROBE WHAT THEY SAID')
    end
  end

  describe '#call with Indonesian language (DEF-P2-01)' do
    let(:language) { 'id' }
    subject(:compiler) { described_class.new(assessment) }

    it 'explicitly permits candidates to use English technical terminology' do
      prompt = compiler.call

      expect(prompt).to include('Conduct this interview primarily in Bahasa Indonesia')
      expect(prompt).to include('candidates are fully permitted to use standard English technical terminology')
      expect(prompt).to include('Do not reprimand candidates or force awkward translations')
    end
  end
end
