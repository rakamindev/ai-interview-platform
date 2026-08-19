# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Vacancy, type: :model do
  describe 'validations' do
    it 'validates presence of role_title' do
      vacancy = build(:vacancy, role_title: nil)
      expect(vacancy).not_to be_valid
      expect(vacancy.errors[:role_title]).to include("can't be blank")
    end
  end

  describe 'associations' do
    it { should have_many(:vacancy_skills).dependent(:destroy) }
    it { should have_many(:fit_gap_reports).dependent(:destroy) }
  end

  describe 'nested attributes' do
    it 'accepts nested attributes for vacancy_skills' do
      vacancy = create(:vacancy)
      vacancy.update(vacancy_skills_attributes: [
        { skill_label: 'React', expected_level: 3 }
      ])
      expect(vacancy.vacancy_skills.count).to eq(1)
    end
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:vacancy)).to be_valid
    end

    it 'has a valid with_skills trait' do
      vacancy = create(:vacancy, :with_skills)
      expect(vacancy.vacancy_skills.count).to eq(2)
    end
  end
end
