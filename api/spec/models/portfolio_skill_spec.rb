# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  let(:org) { Organization.find_or_create_by!(id: 1, name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'localhost') }
  let(:assessment) do
    Current.organization = org
    Current.tenant_id = org.id
    Assessment.create!(name: 'Senior Frontend Engineer', time_limit_min: 45, created_by: 1)
  end
  let(:session_record) do
    Current.organization = org
    Current.tenant_id = org.id
    Session.create!(assessment: assessment, tenant_id: org.id)
  end
  let(:portfolio) { Portfolio.create!(session: session_record, generation_status: 'complete') }

  describe 'validations' do
    it 'is valid with an assessed skill level between 1 and 5' do
      skill = portfolio.portfolio_skills.build(
        skill_label: 'React Core',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Solid React skills'
      )
      expect(skill).to be_valid
    end

    it 'is valid when unassessed with nil ai_level' do
      skill = portfolio.portfolio_skills.build(
        skill_label: 'System Design',
        is_assessed: false,
        ai_level: nil,
        ai_confidence: 'low',
        competency_summary: 'Not assessed'
      )
      expect(skill).to be_valid
      expect(skill.effective_level).to be_nil
    end

    it 'rejects ai_level outside 1..5 when present' do
      skill = portfolio.portfolio_skills.build(
        skill_label: 'React Core',
        ai_level: 6,
        ai_confidence: 'high',
        competency_summary: 'Invalid'
      )
      expect(skill).not_to be_valid
    end
  end

  describe '#effective_level' do
    it 'returns override_level when assessor override exists' do
      skill = portfolio.portfolio_skills.create!(
        skill_label: 'Communication',
        ai_level: 2,
        ai_confidence: 'medium',
        competency_summary: 'Clear 1:1'
      )
      skill.create_assessor_override!(
        ai_level: 2,
        override_level: 4,
        assessor_notes: 'Demonstrated cross-team alignment',
        overridden_by: 1
      )
      expect(skill.effective_level).to eq(4)
    end

    it 'returns ai_level when no override exists' do
      skill = portfolio.portfolio_skills.create!(
        skill_label: 'Communication',
        ai_level: 2,
        ai_confidence: 'medium',
        competency_summary: 'Clear 1:1'
      )
      expect(skill.effective_level).to eq(2)
    end
  end
end
