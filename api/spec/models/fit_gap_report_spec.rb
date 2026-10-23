# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapReport do
  it 'accepts an empty comparison list (a vacancy with no requirements)' do
    expect(build(:fit_gap_report, skill_comparisons: [])).to be_valid
  end

  it 'rejects a missing comparison list' do
    expect(build(:fit_gap_report, skill_comparisons: nil)).not_to be_valid
  end

  describe '#current_rules?' do
    it 'is true only for reports computed by the current comparator' do
      expect(build(:fit_gap_report, comparator_version: FitGap::Comparator::VERSION)).to be_current_rules
      expect(build(:fit_gap_report, comparator_version: FitGap::Comparator::VERSION - 1)).not_to be_current_rules
      expect(build(:fit_gap_report, comparator_version: nil)).not_to be_current_rules
    end
  end
end
