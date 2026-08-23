# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SkillTaxonomy, type: :model do
  describe 'validations' do
    it { is_expected.to validate_presence_of(:skill_id) }
    it { is_expected.to validate_length_of(:skill_id).is_at_most(50) }
    it { is_expected.to validate_presence_of(:skill_label) }
    it { is_expected.to validate_length_of(:skill_label).is_at_most(255) }
    it { is_expected.to validate_presence_of(:category) }
    it { is_expected.to validate_length_of(:category).is_at_most(50) }
    it { is_expected.to validate_presence_of(:l1_anchor) }
    it { is_expected.to validate_presence_of(:l2_anchor) }
    it { is_expected.to validate_presence_of(:l3_anchor) }
    it { is_expected.to validate_presence_of(:l4_anchor) }
    it { is_expected.to validate_presence_of(:l5_anchor) }

    it 'validates skill_id uniqueness' do
      create(:skill_taxonomy, skill_id: 'SK-UNIQUE-001')
      duplicate = build(:skill_taxonomy, skill_id: 'SK-UNIQUE-001')
      duplicate.validate
      expect(duplicate.errors[:skill_id]).to include('has already been taken')
    end
  end

  describe 'constants' do
    it 'defines CATEGORIES' do
      expect(SkillTaxonomy::CATEGORIES).to eq(%w[engineering soft_skills product_process])
    end
  end
end
