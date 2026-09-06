# frozen_string_literal: true

class AssessmentSkill < ApplicationRecord
  include Sanitizable

  sanitize_text_fields :skill_label, :scope_include, :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor

  belongs_to :assessment, inverse_of: :assessment_skills

  validates :skill_label, presence: true
  validates :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor, presence: true
  validates :display_order, presence: true
  validates :expected_level, numericality: { only_integer: true,
                                              in: 1..5,
                                              allow_nil: true }
end
