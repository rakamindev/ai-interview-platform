# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  describe 'validations' do
    subject { build(:assessment) }

    it 'is valid with valid attributes' do
      expect(subject).to be_valid
    end

    it 'requires a name' do
      subject.name = nil
      expect(subject).not_to be_valid
    end

    it 'validates time_limit_min inclusion' do
      subject.time_limit_min = 15
      expect(subject).not_to be_valid

      [10, 30, 45, 60, 90].each do |limit|
        subject.time_limit_min = limit
        expect(subject).to be_valid
      end
    end
  end

  describe 'associations' do
    it 'destroys dependent assessment_skills' do
      assessment = create(:assessment, :with_skills)
      expect { assessment.destroy }.to change(AssessmentSkill, :count).by(-2)
    end
  end
end
