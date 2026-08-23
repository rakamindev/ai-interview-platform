# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Vacancy, type: :model do
  describe 'validations' do
    subject { build(:vacancy) }

    it 'is valid with valid attributes' do
      expect(subject).to be_valid
    end

    it 'requires a role_title' do
      subject.role_title = nil
      expect(subject).not_to be_valid
    end
  end

  describe 'associations' do
    it 'destroys dependent vacancy_skills' do
      vacancy = create(:vacancy, :with_skills)
      expect { vacancy.destroy }.to change(VacancySkill, :count).by(-2)
    end
  end
end
