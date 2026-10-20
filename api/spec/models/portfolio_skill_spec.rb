# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  let(:org) { create_organization }
  let(:user) { create_user }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      created_by: user.id,
      name: 'Ruby Engineer',
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

  describe 'validations for assessment_status (AC-D1, AC-D2)' do
    it 'allows valid assessed skill with ai_level in 1..5' do
      skill = PortfolioSkill.new(
        portfolio: portfolio,
        skill_label: 'Ruby on Rails',
        assessment_status: 'assessed',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Solid Rails knowledge.'
      )
      expect(skill).to be_valid
    end

    it 'allows valid insufficient_evidence skill with ai_level and low confidence' do
      skill = PortfolioSkill.new(
        portfolio: portfolio,
        skill_label: 'Docker',
        assessment_status: 'insufficient_evidence',
        ai_level: 2,
        ai_confidence: 'low',
        competency_summary: 'Limited evidence.'
      )
      expect(skill).to be_valid
    end

    it 'allows not_assessed skill with nil ai_level, nil confidence and valid status_reason' do
      skill = PortfolioSkill.new(
        portfolio: portfolio,
        skill_label: 'System Design',
        assessment_status: 'not_assessed',
        status_reason: 'not_covered',
        ai_level: nil,
        ai_confidence: nil,
        competency_summary: 'Not evaluated.'
      )
      expect(skill).to be_valid
    end

    it 'rejects not_assessed skill if ai_level is present (AC-D2)' do
      skill = PortfolioSkill.new(
        portfolio: portfolio,
        skill_label: 'System Design',
        assessment_status: 'not_assessed',
        status_reason: 'not_covered',
        ai_level: 1,
        ai_confidence: 'low',
        competency_summary: 'Should not have level'
      )
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).to be_present
    end

    it 'rejects assessed skill if ai_level is missing' do
      skill = PortfolioSkill.new(
        portfolio: portfolio,
        skill_label: 'System Design',
        assessment_status: 'assessed',
        ai_level: nil,
        ai_confidence: 'medium',
        competency_summary: 'Missing level'
      )
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).to be_present
    end

    it 'rejects assessed skill if ai_level is outside 1..5' do
      skill = PortfolioSkill.new(
        portfolio: portfolio,
        skill_label: 'System Design',
        assessment_status: 'assessed',
        ai_level: 6,
        ai_confidence: 'medium',
        competency_summary: 'Level out of range'
      )
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).to be_present
    end
  end
end
