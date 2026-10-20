# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  let(:organization) { Organization.create!(name: 'Test Org', scheme: 'calc01', identifier: 'calc01', host: 'calc01.test') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Backend Dev',
      time_limit_min: 30
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: organization.id,
      assessment: assessment,
      invite_token: SecureRandom.hex(16),
      status: :active
    )
  end
  let(:portfolio) { Portfolio.create!(session: session, generation_status: 'complete') }

  describe 'unassessed / nullable ai_level behavior' do
    it 'allows null ai_level and marks skill as unassessed' do
      skill = PortfolioSkill.new(
        portfolio: portfolio,
        skill_label: 'Kubernetes Orchestration',
        ai_level: nil,
        ai_confidence: nil
      )

      expect(skill).to be_valid
      expect(skill.unassessed?).to be true
      expect { skill.save! }.not_to raise_error
      expect(skill.reload.ai_level).to be_nil
    end

    it 'validates assessed skills with integer levels between 1 and 5' do
      skill = PortfolioSkill.new(
        portfolio: portfolio,
        skill_label: 'PostgreSQL Optimization',
        ai_level: 4,
        ai_confidence: 'high',
        competency_summary: 'Demonstrates deep knowledge of query planning.'
      )

      expect(skill).to be_valid
      expect(skill.unassessed?).to be false
      expect { skill.save! }.not_to raise_error
    end

    it 'rejects invalid levels outside 1..5 range when not nil' do
      skill_low = PortfolioSkill.new(portfolio: portfolio, skill_label: 'Go', ai_level: 0)
      skill_high = PortfolioSkill.new(portfolio: portfolio, skill_label: 'Go', ai_level: 6)

      expect(skill_low).not_to be_valid
      expect(skill_high).not_to be_valid
    end

    it 'allows assessor override on unassessed skill' do
      skill = PortfolioSkill.create!(
        portfolio: portfolio,
        skill_label: 'System Architecture',
        ai_level: nil
      )

      override = skill.build_assessor_override(
        ai_level: skill.ai_level,
        override_level: 3,
        assessor_notes: 'Manual evaluation from candidate portfolio review.',
        overridden_by: 99
      )

      expect(override).to be_valid
      expect { override.save! }.not_to raise_error
      expect(override.reload.ai_level).to be_nil
      expect(override.override_level).to eq(3)
    end
  end
end
