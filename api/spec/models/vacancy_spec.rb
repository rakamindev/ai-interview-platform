# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Vacancy, type: :model do
  describe 'validations' do
    it 'validates presence of role_title' do
      vacancy = Vacancy.new(role_title: nil)
      expect(vacancy).not_to be_valid
      expect(vacancy.errors[:role_title]).to be_present
    end

    it 'is valid with valid role_title' do
      vacancy = Vacancy.new(role_title: 'Senior Site Reliability Engineer')
      vacancy.valid?
      expect(vacancy.errors[:role_title]).to be_empty
    end
  end

  describe 'associations & nested attributes' do
    it 'has_many vacancy_skills with allow_destroy' do
      association = Vacancy.reflect_on_association(:vacancy_skills)
      expect(association.macro).to eq(:has_many)
      expect(Vacancy.nested_attributes_options.keys).to include(:vacancy_skills)
    end

    it 'has_many fit_gap_reports' do
      association = Vacancy.reflect_on_association(:fit_gap_reports)
      expect(association.macro).to eq(:has_many)
    end
  end
end
