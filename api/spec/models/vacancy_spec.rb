# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Vacancy, type: :model do
  describe 'associations' do
    it { is_expected.to have_many(:vacancy_skills).dependent(:destroy) }
    it { is_expected.to have_many(:fit_gap_reports).dependent(:destroy) }
  end

  describe 'validations' do
    it 'validates role_title presence' do
      vacancy = build(:vacancy, role_title: nil)
      vacancy.validate
      expect(vacancy.errors[:role_title]).to include("can't be blank")
    end
  end

  describe 'nested attributes' do
    it 'accepts nested attributes for vacancy_skills' do
      vacancy = create(:vacancy)
      vacancy.update(vacancy_skills_attributes: [
        { skill_label: 'New Skill', expected_level: 3 }
      ])
      expect(vacancy.vacancy_skills.count).to eq(1)
    end
  end
end
