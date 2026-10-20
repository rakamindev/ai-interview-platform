# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill do
  it 'accepts levels 1 to 5 and the three confidence values' do
    (1..5).each { |level| expect(build(:portfolio_skill, ai_level: level)).to be_valid }
    %w[high medium low].each { |c| expect(build(:portfolio_skill, ai_confidence: c)).to be_valid }
  end

  it 'rejects levels outside 1 to 5' do
    expect(build(:portfolio_skill, ai_level: 0)).not_to be_valid
    expect(build(:portfolio_skill, ai_level: 6)).not_to be_valid
  end

  it 'rejects confidence values with the wrong case' do
    expect(build(:portfolio_skill, ai_confidence: 'High')).not_to be_valid
  end

  # AC-12: a skill that wasn't assessed has no summary, and a rated one may come without one.
  it 'accepts a skill with no competency summary' do
    expect(build(:portfolio_skill, competency_summary: nil)).to be_valid
  end

  describe 'a skill that was not assessed (Step 4, Option B)' do
    let(:not_assessed) do
      build(:portfolio_skill, ai_level: nil, ai_confidence: nil, competency_summary: nil, evidence: [],
                              not_assessed_reason: 'not_reached')
    end

    it 'has no level, no confidence, and a reason' do
      expect(not_assessed).to be_valid
      expect(not_assessed.assessment_status).to eq('not_assessed')
    end

    it 'accepts only the three reasons' do
      %w[not_reached insufficient_evidence omitted_by_model].each do |reason|
        expect(not_assessed.tap { _1.not_assessed_reason = reason }).to be_valid
      end
      expect(not_assessed.tap { _1.not_assessed_reason = 'other' }).not_to be_valid
    end

    it 'needs a reason when there is no level, and none when there is one' do
      expect(not_assessed.tap { _1.not_assessed_reason = nil }).not_to be_valid
      expect(build(:portfolio_skill, ai_level: 3, not_assessed_reason: 'not_reached')).not_to be_valid
    end

    it 'cannot carry a confidence without a level' do
      record = not_assessed.tap { _1.ai_confidence = 'high' }

      expect(record).not_to be_valid
      expect(record.errors[:ai_confidence]).to be_present
    end
  end

  it 'reports a rated skill as assessed' do
    expect(build(:portfolio_skill, ai_level: 3).assessment_status).to eq('assessed')
  end

  it 'always returns evidence as an array' do
    expect(build(:portfolio_skill, evidence: nil).evidence_quotes).to eq([])
  end
end
