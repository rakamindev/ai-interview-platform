# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler do
  let(:org) do
    Organization.create!(
      name: 'Test Org',
      scheme: 'test-org-compiler',
      identifier: 'test-org-compiler',
      host: 'compiler.test.com'
    )
  end
  let(:user) { User.create!(email: 'tester@example.com', password: 'password', role: 'assessor') }
  let(:assessment_en) do
    Assessment.create!(
      name: 'Senior Frontend Engineer',
      language: 'en',
      time_limit_min: 45,
      tenant_id: org.id,
      created_by: user.id
    )
  end

  let(:assessment_id) do
    Assessment.create!(
      name: 'Fullstack Engineer Indonesia',
      language: 'id',
      time_limit_min: 45,
      tenant_id: org.id,
      created_by: user.id
    )
  end

  before do
    assessment_en.assessment_skills.create!(
      skill_label: 'React Architecture',
      display_order: 0,
      l1_anchor: 'Basic hooks',
      l2_anchor: 'Custom hooks',
      l3_anchor: 'State management',
      l4_anchor: 'Performance profiling',
      l5_anchor: 'Core architecture'
    )

    assessment_id.assessment_skills.create!(
      skill_label: 'PostgreSQL Database Design',
      display_order: 0,
      l1_anchor: 'Basic queries',
      l2_anchor: 'Joins and indexes',
      l3_anchor: 'Query optimization',
      l4_anchor: 'Sharding and partitioning',
      l5_anchor: 'Storage engine tuning'
    )
  end

  describe '#call' do
    it 'compiles English prompt correctly' do
      compiler = described_class.new(assessment_en)
      prompt = compiler.call

      expect(prompt).to include('You are an expert skills assessor')
      expect(prompt).to include('LANGUAGE: Conduct this entire interview in English.')
      expect(prompt).to include('SKILL: React Architecture')
    end

    it 'compiles Bahasa Indonesia prompt correctly with explicit language instructions' do
      compiler = described_class.new(assessment_id)
      prompt = compiler.call

      expect(prompt).to include('Bahasa Indonesia')
      expect(prompt).to include('LANGUAGE MANDATE: Conduct this ENTIRE interview fluently, politely, and naturally in Bahasa Indonesia.')
      expect(prompt).to include('SKILL: PostgreSQL Database Design')
      expect(prompt).to include('Halo, terima kasih sudah bergabung dalam wawancara ini.')
    end
  end
end
