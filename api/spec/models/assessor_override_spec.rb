# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessorOverride, type: :model do
  let(:org) { create_organization }
  let(:user) { create_user }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: user.id,
      name: 'Backend Dev',
      time_limit_min: 30
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment_id: assessment.id,
      invite_token: SecureRandom.hex(16),
      status: 'ended'
    )
  end
  let(:portfolio) do
    Portfolio.create!(
      session_id: session.id,
      generation_status: 'complete'
    )
  end
  let(:unassessed_skill) do
    PortfolioSkill.create!(
      portfolio: portfolio,
      skill_label: 'Kubernetes',
      assessment_status: 'not_assessed',
      status_reason: 'not_covered',
      ai_level: nil,
      ai_confidence: nil,
      competency_summary: 'Not evaluated.'
    )
  end

  describe 'AC-D3 assessor overrides validations' do
    it 'allows overriding a not_assessed skill with nil ai_level' do
      override = AssessorOverride.new(
        portfolio_skill: unassessed_skill,
        ai_level: nil,
        override_level: 4,
        assessor_notes: 'Demonstrated deep Kubernetes knowledge outside regular probes.',
        overridden_by: user.id
      )
      expect(override).to be_valid
    end

    it 'requires assessor_notes to be non-blank (rejects whitespace)' do
      override = AssessorOverride.new(
        portfolio_skill: unassessed_skill,
        ai_level: nil,
        override_level: 4,
        assessor_notes: '   ',
        overridden_by: user.id
      )
      expect(override).not_to be_valid
      expect(override.errors[:assessor_notes]).to be_present
    end

    it 'rejects assessor_notes longer than 2000 chars' do
      override = AssessorOverride.new(
        portfolio_skill: unassessed_skill,
        ai_level: nil,
        override_level: 4,
        assessor_notes: 'a' * 2001,
        overridden_by: user.id
      )
      expect(override).not_to be_valid
      expect(override.errors[:assessor_notes]).to be_present
    end

    it 'rejects override_level outside 1..5' do
      override = AssessorOverride.new(
        portfolio_skill: unassessed_skill,
        ai_level: nil,
        override_level: 6,
        assessor_notes: 'Invalid level',
        overridden_by: user.id
      )
      expect(override).not_to be_valid
      expect(override.errors[:override_level]).to be_present
    end
  end
end
