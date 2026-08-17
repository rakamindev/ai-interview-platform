# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill, type: :model do
  describe 'ai_level' do
    it 'allows a valid 1..5 level' do
      skill = build(:portfolio_skill, ai_level: 3)
      expect(skill).to be_valid
    end

    it 'allows nil (not assessed)' do
      skill = build(:portfolio_skill, ai_level: nil, ai_confidence: nil)
      expect(skill).to be_valid
    end

    it 'rejects out-of-range levels' do
      [0, 6].each do |bad|
        skill = build(:portfolio_skill, ai_level: bad)
        expect(skill).not_to be_valid
      end
    end
  end

  describe '#requires_review?' do
    it 'flags a skill with no valid level' do
      skill = build(:portfolio_skill, ai_level: nil)
      expect(skill.requires_review?).to be true
    end

    it 'flags a skill with unverified evidence' do
      skill = build(:portfolio_skill, ai_level: 3, evidence_provenance: [])
      expect(skill.requires_review?).to be true
    end

    it 'flags a skill with low confidence' do
      skill = build(:portfolio_skill, ai_level: 3, ai_confidence: 'low', evidence_provenance: [{ 'verified' => true }])
      expect(skill.requires_review?).to be true
    end

    it 'flags a skill with insufficient_evidence review' do
      skill = create(:portfolio_skill, ai_level: 3, evidence_provenance: [{ 'verified' => true }])
      create(:assessor_override, portfolio_skill: skill, outcome: 'insufficient_evidence', reviewed_level: nil, ai_level: 3, rationale: 'No signal')
      expect(skill.requires_review?).to be true
    end

    it 'is false for a fully verified, high-confidence skill' do
      skill = build(:portfolio_skill, ai_level: 3, ai_confidence: 'high', evidence_provenance: [{ 'verified' => true }])
      expect(skill.requires_review?).to be false
    end
  end

  describe '#review_reasons' do
    it 'lists no_valid_level for nil level' do
      skill = build(:portfolio_skill, ai_level: nil)
      expect(skill.review_reasons).to include('no_valid_level')
    end

    it 'lists low_confidence for low confidence' do
      skill = build(:portfolio_skill, ai_level: 3, ai_confidence: 'low')
      expect(skill.review_reasons).to include('low_confidence')
    end

    it 'lists unverified_evidence without provenance' do
      skill = build(:portfolio_skill, ai_level: 3, evidence_provenance: [])
      expect(skill.review_reasons).to include('unverified_evidence')
    end
  end
end
