# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessmentSkill, type: :model do
  describe 'validations' do
    it { should validate_presence_of(:skill_label) }
    it { should validate_presence_of(:l1_anchor) }
    it { should validate_presence_of(:l2_anchor) }
    it { should validate_presence_of(:l3_anchor) }
    it { should validate_presence_of(:l4_anchor) }
    it { should validate_presence_of(:l5_anchor) }
    it { should validate_presence_of(:display_order) }
  end

  describe 'associations' do
    it { should belong_to(:assessment) }
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:assessment_skill)).to be_valid
    end
  end
end
