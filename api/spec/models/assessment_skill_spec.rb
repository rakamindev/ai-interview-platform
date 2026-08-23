# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AssessmentSkill, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:assessment).inverse_of(:assessment_skills) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:skill_label) }
    it { is_expected.to validate_presence_of(:l1_anchor) }
    it { is_expected.to validate_presence_of(:l2_anchor) }
    it { is_expected.to validate_presence_of(:l3_anchor) }
    it { is_expected.to validate_presence_of(:l4_anchor) }
    it { is_expected.to validate_presence_of(:l5_anchor) }
    it { is_expected.to validate_presence_of(:display_order) }
    it { is_expected.to validate_numericality_of(:expected_level).only_integer.is_in(1..5).allow_nil }
  end

  describe 'nested attributes' do
    it 'allows _destroy flag' do
      assessment = create(:assessment)
      skill = create(:assessment_skill, assessment: assessment)

      assessment.update(assessment_skills_attributes: { '0' => { id: skill.id, _destroy: '1' } })
      expect(assessment.assessment_skills).not_to include(skill)
    end
  end
end