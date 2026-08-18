# frozen_string_literal: true

class AssessmentSkill < ApplicationRecord
  belongs_to :assessment, inverse_of: :assessment_skills

  validates :skill_label, presence: true
  validates :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor, presence: true
  validates :display_order, presence: true
  validates :expected_level, numericality: { only_integer: true,
                                              in: 1..5,
                                              allow_nil: true }

  before_validation :set_tenant_id_from_assessment, on: :create

  private

  def set_tenant_id_from_assessment
    self.tenant_id ||= assessment&.tenant_id
  end
end
