# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SkillTaxonomy, type: :model do
  describe 'validations' do
    it { should validate_presence_of(:skill_id) }
    it { should validate_presence_of(:skill_label) }
    it { should validate_length_of(:skill_label).is_at_most(255) }
    it { should validate_presence_of(:category) }
    it { should validate_length_of(:category).is_at_most(50) }
    it { should validate_presence_of(:l1_anchor) }
    it { should validate_presence_of(:l2_anchor) }
    it { should validate_presence_of(:l3_anchor) }
    it { should validate_presence_of(:l4_anchor) }
    it { should validate_presence_of(:l5_anchor) }

    it 'validates uniqueness of skill_id' do
      existing = create(:skill_taxonomy, skill_id: 'sk-unique')
      duplicate = build(:skill_taxonomy, skill_id: 'sk-unique')
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:skill_id]).to be_present
    end
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:skill_taxonomy)).to be_valid
    end
  end
end
