# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapReport, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:portfolio) }
    it { is_expected.to belong_to(:vacancy) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:skill_comparisons) }
  end

  describe 'constants' do
    it 'defines FIT_RESULTS' do
      expect(FitGapReport::FIT_RESULTS).to eq(%w[match gap exceed not_assessed])
    end
  end
end
