# frozen_string_literal: true

class AssessmentSkill < ApplicationRecord
  belongs_to :assessment, inverse_of: :assessment_skills

  validates :skill_label, presence: true
  validates :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor, presence: true
  validates :display_order, presence: true
  validates :expected_level, numericality: { only_integer: true,
                                              in: 1..5,
                                              allow_nil: true }

  before_validation :lookup_skill_id

  private

  def lookup_skill_id
    return if skill_label.blank?

    taxonomy = SkillTaxonomy.find_by(skill_label: skill_label)
    self.skill_id = taxonomy&.skill_id
  end
end
