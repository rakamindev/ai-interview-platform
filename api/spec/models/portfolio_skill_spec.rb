# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  let(:org) { set_current_tenant }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: session) }

  describe 'validations' do
    it 'is valid with valid attributes' do
      skill = build(:portfolio_skill, portfolio: portfolio)
      expect(skill).to be_valid
    end

    it 'is invalid without a skill_label' do
      skill = build(:portfolio_skill, portfolio: portfolio, skill_label: nil)
      expect(skill).not_to be_valid
      expect(skill.errors[:skill_label]).to include("can't be blank")
    end

    it 'is invalid if ai_level is less than 1 or greater than 5' do
      expect(build(:portfolio_skill, portfolio: portfolio, ai_level: 0)).not_to be_valid
      expect(build(:portfolio_skill, portfolio: portfolio, ai_level: 6)).not_to be_valid
    end

    it 'is invalid with an unrecognized confidence level' do
      expect(build(:portfolio_skill, portfolio: portfolio, ai_confidence: 'unrecognized')).not_to be_valid
    end

    it 'is invalid without a competency_summary' do
      skill = build(:portfolio_skill, portfolio: portfolio, competency_summary: nil)
      expect(skill).not_to be_valid
      expect(skill.errors[:competency_summary]).to include("can't be blank")
    end
  end

  describe '#evidence_quotes' do
    it 'returns the array of evidence quotes' do
      skill = create(:portfolio_skill, portfolio: portfolio, evidence: ['Quote 1', 'Quote 2'])
      expect(skill.evidence_quotes).to eq(['Quote 1', 'Quote 2'])
    end

    it 'handles nil evidence gracefully' do
      skill = create(:portfolio_skill, portfolio: portfolio, evidence: [])
      expect(skill.evidence_quotes).to eq([])
    end
  end
end
