# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessorOverride, type: :model do
  describe 'validations' do
    it 'validates ai_level is between 1 and 5' do
      (1..5).each do |level|
        override = build(:assessor_override, ai_level: level)
        expect(override).to be_valid
      end

      [0, 6, -1].each do |level|
        override = build(:assessor_override, ai_level: level)
        expect(override).not_to be_valid
      end
    end

    it 'validates override_level is between 1 and 5' do
      (1..5).each do |level|
        override = build(:assessor_override, override_level: level)
        expect(override).to be_valid
      end

      [0, 6, -1].each do |level|
        override = build(:assessor_override, override_level: level)
        expect(override).not_to be_valid
      end
    end

    it 'validates presence of overridden_by' do
      override = build(:assessor_override, overridden_by: nil)
      expect(override).not_to be_valid
      expect(override.errors[:overridden_by]).to be_present
    end
  end

  describe 'associations' do
    it { should belong_to(:portfolio_skill) }
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:assessor_override)).to be_valid
    end
  end
end
