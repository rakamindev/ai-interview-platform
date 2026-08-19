# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  describe 'validations' do
    it 'validates presence of name' do
      assessment = build(:assessment, name: nil)
      expect(assessment).not_to be_valid
      expect(assessment.errors[:name]).to include("can't be blank")
    end

    it 'validates time_limit_min inclusion' do
      assessment = build(:assessment, time_limit_min: 999)
      expect(assessment).not_to be_valid
      expect(assessment.errors[:time_limit_min]).to be_present
    end

    it 'validates time_limit_min is one of the allowed values' do
      [10, 30, 45, 60, 90].each do |minutes|
        assessment = build(:assessment, time_limit_min: minutes)
        expect(assessment).to be_valid
      end
    end

    it 'validates language inclusion' do
      assessment = build(:assessment, language: 'fr')
      expect(assessment).not_to be_valid
      expect(assessment.errors[:language]).to be_present
    end

    it 'allows nil language' do
      assessment = build(:assessment, language: nil)
      expect(assessment).to be_valid
    end
  end

  describe 'associations' do
    it { should have_many(:assessment_skills).dependent(:destroy) }
    it { should have_many(:sessions).dependent(:restrict_with_error) }
  end

  describe 'nested attributes' do
    it 'accepts nested attributes for assessment_skills' do
      assessment = create(:assessment)
      assessment.update(assessment_skills_attributes: [
        { skill_label: 'React', l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5', display_order: 1 }
      ])
      expect(assessment.assessment_skills.count).to eq(1)
    end
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:assessment)).to be_valid
    end

    it 'has a valid with_skills trait' do
      assessment = create(:assessment, :with_skills)
      expect(assessment.assessment_skills.count).to eq(2)
    end
  end
end
