# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessorOverride, type: :model do
  let(:skill) { create(:portfolio_skill, ai_level: 3) }

  describe 'outcome validation' do
    it 'accepts confirmed with a rationale-free review' do
      override = build(:assessor_override, outcome: 'confirmed', reviewed_level: nil, rationale: 'Agreed with AI', ai_level: 3)
      expect(override).to be_valid
    end

    it 'accepts adjusted with a reviewed level and rationale' do
      override = build(:assessor_override, outcome: 'adjusted', reviewed_level: 4, rationale: 'Stronger evidence')
      expect(override).to be_valid
    end

    it 'accepts insufficient_evidence with rationale and no level' do
      override = build(:assessor_override, outcome: 'insufficient_evidence', reviewed_level: nil, rationale: 'No signal', ai_level: 3)
      expect(override).to be_valid
    end

    it 'rejects adjusted without a reviewed level' do
      override = build(:assessor_override, outcome: 'adjusted', reviewed_level: nil, rationale: 'x')
      expect(override).not_to be_valid
      expect(override.errors[:reviewed_level]).to be_present
    end

    it 'rejects adjusted without rationale' do
      override = build(:assessor_override, outcome: 'adjusted', reviewed_level: 4, rationale: nil)
      expect(override).not_to be_valid
      expect(override.errors[:rationale]).to be_present
    end

    it 'rejects insufficient_evidence without rationale' do
      override = build(:assessor_override, outcome: 'insufficient_evidence', rationale: nil)
      expect(override).not_to be_valid
      expect(override.errors[:rationale]).to be_present
    end

    it 'rejects confirmed with a reviewed level' do
      override = build(:assessor_override, outcome: 'confirmed', reviewed_level: 2, rationale: 'x')
      expect(override).not_to be_valid
      expect(override.errors[:reviewed_level]).to be_present
    end

    it 'rejects out-of-range reviewed levels' do
      [0, 6, -1].each do |bad|
        override = build(:assessor_override, outcome: 'adjusted', reviewed_level: bad, rationale: 'x')
        expect(override).not_to be_valid
      end
    end

    it 'rejects unknown outcomes' do
      override = build(:assessor_override, outcome: 'maybe')
      expect(override).not_to be_valid
      expect(override.errors[:outcome]).to be_present
    end
  end

  describe '#effective_level' do
    it 'uses the AI level when confirmed' do
      override = build(:assessor_override, outcome: 'confirmed', ai_level: 3, reviewed_level: nil)
      expect(override.effective_level).to eq(3)
    end

    it 'uses the reviewed level when adjusted' do
      override = build(:assessor_override, outcome: 'adjusted', ai_level: 3, reviewed_level: 4)
      expect(override.effective_level).to eq(4)
    end

    it 'is nil when insufficient_evidence' do
      override = build(:assessor_override, outcome: 'insufficient_evidence', ai_level: 3, reviewed_level: nil)
      expect(override.effective_level).to be_nil
    end
  end
end
