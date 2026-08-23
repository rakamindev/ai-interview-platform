# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  describe 'associations' do
    it { is_expected.to have_many(:assessment_skills).dependent(:destroy) }
    it { is_expected.to have_many(:sessions).dependent(:restrict_with_error) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:name) }

    it 'validates time_limit_min presence and inclusion' do
      assessment = build(:assessment, time_limit_min: nil)
      assessment.validate
      expect(assessment.errors[:time_limit_min]).to include("can't be blank")
    end

    it 'validates time_limit_min inclusion' do
      assessment = build(:assessment, time_limit_min: 20)
      assessment.validate
      expect(assessment.errors[:time_limit_min]).to include('is not included in the list')
    end

    it 'validates language inclusion when present' do
      assessment = build(:assessment, language: 'fr')
      assessment.validate
      expect(assessment.errors[:language]).to include('is not included in the list')
    end

    it 'allows nil language' do
      assessment = build(:assessment, language: nil)
      expect(assessment).to be_valid
    end
  end

  describe 'constants' do
    it 'defines SUPPORTED_LANGUAGES' do
      expect(Assessment::SUPPORTED_LANGUAGES).to eq({ 'en' => 'English', 'id' => 'Bahasa Indonesia' })
    end
  end

  describe 'nested attributes' do
    it 'accepts nested attributes for assessment_skills' do
      assessment = create(:assessment)
      assessment.update(assessment_skills_attributes: [
        { skill_label: 'New Skill', l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5', display_order: 0 }
      ])
      expect(assessment.assessment_skills.count).to eq(1)
    end
  end
end
