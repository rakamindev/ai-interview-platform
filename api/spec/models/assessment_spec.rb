# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  describe 'validations' do
    it 'requires a name' do
      assessment = build(:assessment, name: nil)
      expect(assessment).not_to be_valid
      expect(assessment.errors[:name]).to include("can't be blank")
    end

    it 'validates time_limit_min inclusion' do
      [10, 30, 45, 60, 90].each do |valid_limit|
        assessment = build(:assessment, time_limit_min: valid_limit)
        expect(assessment).to be_valid
      end

      invalid_assessment = build(:assessment, time_limit_min: 25)
      expect(invalid_assessment).not_to be_valid
    end
  end

  describe 'deletion restriction with existing sessions' do
    let!(:assessment) { create(:assessment) }

    it 'allows deleting an assessment when no sessions exist' do
      expect { assessment.destroy }.to change(Assessment, :count).by(-1)
    end

    it 'restricts deletion when candidate sessions exist' do
      create(:session, assessment: assessment)
      expect(assessment.destroy).to be false
      expect(assessment.errors[:base]).to be_present
    end
  end
end
