# frozen_string_literal: true

class AssessmentSkill < ApplicationRecord
  belongs_to :assessment, inverse_of: :assessment_skills

  validates :skill_label, presence: true,
                          uniqueness: { scope: :assessment_id,
                                        message: 'has already been added to this assessment' }
  validates :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor, presence: true
  validates :display_order, presence: true
  validates :expected_level, numericality: { only_integer: true,
                                              in: 1..5,
                                              allow_nil: true }

  # Uniqueness-with-scope cannot see duplicate IN-MEMORY siblings in a nested
  # attributes batch — reject them explicitly so the API answers 422, not 500.
  # Reads the DB directly (never the association cache) so this validator cannot
  # poison the association for callers who read it afterwards.
  validate :no_duplicate_skill_labels

  private

  def no_duplicate_skill_labels
    in_memory = assessment.association(:assessment_skills).target.filter_map(&:skill_label)
    persisted = assessment.persisted? ? AssessmentSkill.where(assessment_id: assessment.id).pluck(:skill_label) : []
    labels = in_memory + persisted
    return if labels.size == labels.uniq.size

    errors.add(:skill_label, 'has already been added to this assessment')
  end
end
