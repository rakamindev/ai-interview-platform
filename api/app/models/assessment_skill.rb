# frozen_string_literal: true

class AssessmentSkill < ApplicationRecord
  belongs_to :assessment, inverse_of: :assessment_skills

  validates :skill_label, presence: true,
                          uniqueness: { scope: :assessment_id, case_sensitive: false, message: 'has already been added to this assessment' }
  validates :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor, presence: true
  validates :display_order, presence: true
  validates :expected_level, numericality: { only_integer: true,
                                              in: 1..5,
                                              allow_nil: true }
end
