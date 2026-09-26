# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SkillTaxonomy, type: :model do
  describe 'validations' do
    subject(:taxonomy) do
      described_class.new(
        skill_id: 'SK-TEST-001',
        skill_label: 'Test Skill',
        category: 'engineering',
        l1_anchor: 'L1 anchor description',
        l2_anchor: 'L2 anchor description',
        l3_anchor: 'L3 anchor description',
        l4_anchor: 'L4 anchor description',
        l5_anchor: 'L5 anchor description'
      )
    end

    it 'is valid with valid attributes' do
      expect(taxonomy).to be_valid
    end

    it 'is invalid without a skill_id' do
      taxonomy.skill_id = nil
      expect(taxonomy).not_to be_valid
    end

    it 'is invalid with a duplicate skill_id' do
      taxonomy.save!
      duplicate = taxonomy.dup
      expect(duplicate).not_to be_valid
    end

    it 'is invalid without anchors' do
      taxonomy.l1_anchor = nil
      expect(taxonomy).not_to be_valid
    end
  end
end
