# frozen_string_literal: true

class AssessmentSkill < ApplicationRecord
  belongs_to :assessment, inverse_of: :assessment_skills

  validates :skill_label, presence: true
  validates :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor, presence: true
  validates :display_order, presence: true
  validates :expected_level, numericality: { only_integer: true,
                                              in: 1..5,
                                              allow_nil: true }
  validate :unique_skill_label_within_assessment

  private

  def unique_skill_label_within_assessment
    return unless assessment && skill_label.present?

    siblings = assessment.assessment_skills.reject(&:marked_for_destruction?)
    duplicates = siblings.select { |s| s.skill_label.casecmp?(skill_label) && s != self }
    if duplicates.any?
      errors.add(:skill_label, "is already added to this assessment")
    end
  end
end
