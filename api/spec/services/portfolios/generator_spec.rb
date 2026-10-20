# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator, type: :service do
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

  let!(:skill) do
    portfolio.portfolio_skills.create!(
      skill_id: 'sk-eng-001',
      skill_label: 'React / Frontend Development',
      is_discovered: false,
      ai_level: 2,
      ai_confidence: 'medium',
      evidence: ['quote 1'],
      competency_summary: 'Initial assessment.'
    )
  end

  let!(:override) do
    AssessorOverride.create!(
      portfolio_skill: skill,
      ai_level: 2,
      override_level: 4,
      assessor_notes: 'Candidate showed advanced architectural knowledge during live review.',
      overridden_by: 101,
      overridden_at: Time.current
    )
  end

  let(:generator) { described_class.new(session: session) }

  let(:ai_response) do
    {
      'configured_skills' => [
        {
          'skill_id' => 'sk-eng-001',
          'skill_label' => 'React / Frontend Development',
          'level' => 3,
          'confidence' => 'high',
          'evidence' => ['new quote 1', 'new quote 2'],
          'competency_summary' => 'Updated competency summary from regenerated transcript analysis.'
        }
      ],
      'discovered_skills' => []
    }
  end

  describe '#save_skills (DATA-01)' do
    it 'preserves assessor overrides when regenerating skills instead of destroying them' do
      expect(skill.assessor_override).to be_present

      # Trigger skill saving (simulating portfolio regeneration)
      generator.send(:save_skills, portfolio, ai_response)

      # Reload the skill
      updated_skill = portfolio.portfolio_skills.find_by(skill_id: 'sk-eng-001')
      expect(updated_skill).to be_present
      expect(updated_skill.ai_level).to eq(3)
      expect(updated_skill.competency_summary).to eq('Updated competency summary from regenerated transcript analysis.')

      # Critical data integrity check: the assessor override MUST NOT be destroyed!
      expect(updated_skill.assessor_override).to be_present
      expect(updated_skill.assessor_override.override_level).to eq(4)
      expect(updated_skill.assessor_override.assessor_notes).to eq(
        'Candidate showed advanced architectural knowledge during live review.'
      )
    end
  end
end
