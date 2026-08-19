# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapReport, type: :model do
  describe 'validations' do
    it { should validate_presence_of(:skill_comparisons) }
  end

  describe 'associations' do
    it { should belong_to(:portfolio) }
    it { should belong_to(:vacancy) }
  end

  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:fit_gap_report)).to be_valid
    end
  end
end
