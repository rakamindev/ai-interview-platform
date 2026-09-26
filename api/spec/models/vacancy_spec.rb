# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Vacancy, type: :model do
  before do
    Current.tenant_id = 1
  end

  describe 'validations' do
    it 'rejects duplicate skill labels in nested attributes' do
      vacancy = Vacancy.new(
        role_title: 'Senior Backend Engineer',
        vacancy_skills_attributes: [
          { skill_label: 'PostgreSQL', expected_level: 4 },
          { skill_label: 'postgresql', expected_level: 3 }
        ]
      )
      expect(vacancy.valid?).to be false
      expect(vacancy.errors[:base].first).to include('Duplicate skill labels detected')
    end

    it 'is valid when skills have unique labels' do
      vacancy = Vacancy.new(
        role_title: 'Senior Backend Engineer',
        vacancy_skills_attributes: [
          { skill_label: 'PostgreSQL', expected_level: 4 },
          { skill_label: 'Redis', expected_level: 3 }
        ]
      )
      expect(vacancy.valid?).to be true
    end
  end
end

