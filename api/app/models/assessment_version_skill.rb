# frozen_string_literal: true

class AssessmentVersionSkill < ApplicationRecord
  belongs_to :assessment_version

  attr_readonly :assessment_version_id, :skill_id, :skill_label, :is_custom,
                :scope_include, :scope_exclude, :l1_anchor, :l2_anchor, :l3_anchor,
                :l4_anchor, :l5_anchor, :expected_level, :display_order

  before_update :prevent_mutation
  before_destroy :prevent_destruction
  before_create :prevent_unpublished_skill_addition

  validates :skill_label, presence: true
  validates :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor, presence: true
  validates :expected_level, numericality: { only_integer: true, in: 1..5 }
  validates :display_order, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  private

  def prevent_mutation
    errors.add(:base, 'Published assessment version skills are immutable')
    throw(:abort)
  end

  def prevent_destruction
    errors.add(:base, 'Published assessment version skills cannot be deleted')
    throw(:abort)
  end

  def prevent_unpublished_skill_addition
    return if assessment_version&.allowing_skill_copies?

    errors.add(:base, 'Assessment version skills can only be created while publishing a version')
    throw(:abort)
  end
end
