# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessorOverride, type: :model do
  describe 'validations' do
    it 'is valid when level is unchanged even without notes' do
      override = described_class.new(
        ai_level: 3,
        override_level: 3,
        overridden_by: 1
      )
      override.valid?
      expect(override.errors[:assessor_notes]).to be_empty
    end

    it 'is invalid when level is changed but notes are missing' do
      override = described_class.new(
        ai_level: 2,
        override_level: 4,
        overridden_by: 1,
        assessor_notes: nil
      )
      expect(override).not_to be_valid
      expect(override.errors[:assessor_notes]).to include('is mandatory when overriding AI assessment level')
    end

    it 'is invalid when notes are too short (< 10 chars)' do
      override = described_class.new(
        ai_level: 2,
        override_level: 4,
        overridden_by: 1,
        assessor_notes: 'too short'
      )
      expect(override).not_to be_valid
      expect(override.errors[:assessor_notes]).to include('must be at least 10 characters explaining your rationale')
    end

    it 'is valid when level is changed and comprehensive notes are provided' do
      override = described_class.new(
        ai_level: 2,
        override_level: 4,
        overridden_by: 1,
        assessor_notes: 'Candidate demonstrated deep architecture expertise during the system design inquiry.'
      )
      override.valid?
      expect(override.errors[:assessor_notes]).to be_empty
    end
  end
end

