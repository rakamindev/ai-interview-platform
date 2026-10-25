# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  describe 'validations' do
    it 'validates presence of name' do
      assessment = Assessment.new(name: nil, time_limit_min: 45)
      expect(assessment).not_to be_valid
      expect(assessment.errors[:name]).to be_present
    end

    it 'validates time_limit_min inclusion in [10, 30, 45, 60, 90]' do
      [10, 30, 45, 60, 90].each do |valid_limit|
        assessment = Assessment.new(name: 'Valid Role', time_limit_min: valid_limit)
        assessment.valid?
        expect(assessment.errors[:time_limit_min]).to be_empty
      end

      invalid_assessment = Assessment.new(name: 'Invalid Limit Role', time_limit_min: 25)
      expect(invalid_assessment).not_to be_valid
      expect(invalid_assessment.errors[:time_limit_min]).to be_present
    end

    it 'validates language inclusion in supported languages' do
      valid_en = Assessment.new(name: 'EN Role', time_limit_min: 45, language: 'en')
      valid_en.valid?
      expect(valid_en.errors[:language]).to be_empty

      valid_id = Assessment.new(name: 'ID Role', time_limit_min: 45, language: 'id')
      valid_id.valid?
      expect(valid_id.errors[:language]).to be_empty

      invalid_lang = Assessment.new(name: 'FR Role', time_limit_min: 45, language: 'fr')
      expect(invalid_lang).not_to be_valid
      expect(invalid_lang.errors[:language]).to be_present
    end
  end

  describe 'associations & nested attributes' do
    it 'has_many assessment_skills with allow_destroy' do
      association = Assessment.reflect_on_association(:assessment_skills)
      expect(association.macro).to eq(:has_many)
      expect(assessment_class_nested_attributes_options).to include(:assessment_skills)
    end
  end

  def assessment_class_nested_attributes_options
    Assessment.nested_attributes_options.keys
  end
end
