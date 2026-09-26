# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, type: :model do
  before do
    Current.tenant_id = 1
  end

  describe 'validations' do
    it 'requires at least one skill on create' do
      assessment = Assessment.new(
        name: 'Backend Engineer',
        time_limit_min: 45,
        language: 'en'
      )
      expect(assessment.valid?).to be false
      expect(assessment.errors[:base]).to include('Assessment must have at least one skill to assess.')
    end

    it 'rejects duplicate skill labels (case-insensitive) in nested attributes' do
      assessment = Assessment.new(
        name: 'Backend Engineer',
        time_limit_min: 45,
        language: 'en',
        assessment_skills_attributes: [
          {
            skill_label: 'Ruby on Rails',
            expected_level: 3,
            display_order: 0,
            l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
          },
          {
            skill_label: 'ruby on rails',
            expected_level: 4,
            display_order: 1,
            l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
          }
        ]
      )
      expect(assessment.valid?).to be false
      expect(assessment.errors[:base].first).to include('Duplicate skill labels detected')
    end

    it 'is valid when skills have unique labels' do
      assessment = Assessment.new(
        name: 'Fullstack Engineer',
        time_limit_min: 45,
        language: 'en',
        assessment_skills_attributes: [
          {
            skill_label: 'Ruby on Rails',
            expected_level: 3,
            display_order: 0,
            l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
          },
          {
            skill_label: 'React Frontend',
            expected_level: 3,
            display_order: 1,
            l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
          }
        ]
      )
      expect(assessment.valid?).to be true
    end
  end
end

