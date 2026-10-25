# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CoverageMap, type: :model do
  describe 'validations' do
    it 'validates skill_label presence' do
      coverage = CoverageMap.new
      expect(coverage).not_to be_valid
      expect(coverage.errors[:skill_label]).to be_present
    end

    it 'validates state inclusion in STATES' do
      coverage = CoverageMap.new(skill_label: 'Docker', probe_count: 0)

      coverage.state = 'invalid_state'
      expect(coverage).not_to be_valid
      expect(coverage.errors[:state]).to be_present

      CoverageMap::STATES.each do |st|
        coverage.state = st
        coverage.valid?
        expect(coverage.errors[:state]).to be_empty
      end
    end

    it 'validates probe_count is non-negative integer' do
      coverage = CoverageMap.new(skill_label: 'Docker', state: 'not_yet', probe_count: -1)
      expect(coverage).not_to be_valid
      expect(coverage.errors[:probe_count]).to be_present
    end
  end
end
