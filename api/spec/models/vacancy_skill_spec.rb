# frozen_string_literal: true

require 'rails_helper'

RSpec.describe VacancySkill, type: :model do
  describe 'validations' do
    it { should validate_presence_of(:skill_label) }

    it 'validates expected_level is between 1 and 5' do
      (1..5).each do |level|
        skill = build(:vacancy_skill, expected_level: level)
        expect(skill).to be_valid
      end

      [0, 6, -1].each do |level|
        skill = build(:vacancy_skill, expected_level: level)
        expect(skill).not_to be_valid
      end
    end
  end

  describe 'associations' do
    it { should belong_to(:vacancy) }
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:vacancy_skill)).to be_valid
    end
  end
end
