# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  describe 'validations' do
    it 'is valid with valid attributes' do
      assessment = build(:assessment)
      expect(assessment).to be_valid
    end

    it 'is invalid without a name' do
      assessment = build(:assessment, name: nil)
      expect(assessment).not_to be_valid
    end

    it 'enforces time_limit_min to be in allowed options [10, 30, 45, 60, 90]' do
      valid_assessment = build(:assessment, time_limit_min: 45)
      expect(valid_assessment).to be_valid

      invalid_assessment = build(:assessment, time_limit_min: 25)
      expect(invalid_assessment).not_to be_valid
    end
  end
end
