# frozen_string_literal: true

class AssessmentSkill < ApplicationRecord
  belongs_to :assessment, inverse_of: :assessment_skills

  before_validation :set_default_anchors

  validates :skill_label, presence: true
  validates :display_order, presence: true
  # l1–l5 anchors are guaranteed by before_validation :set_default_anchors, so no presence check needed
  validates :expected_level, numericality: { only_integer: true,
                                              in: 1..5,
                                              allow_nil: true }

  private

  def set_default_anchors
    if skill_id.present? && l1_anchor.blank?
      taxonomy = SkillTaxonomy.find_by(skill_id: skill_id)
      if taxonomy
        self.scope_include ||= taxonomy.scope_include
        self.scope_exclude ||= taxonomy.scope_exclude
        self.l1_anchor     ||= taxonomy.l1_anchor
        self.l2_anchor     ||= taxonomy.l2_anchor
        self.l3_anchor     ||= taxonomy.l3_anchor
        self.l4_anchor     ||= taxonomy.l4_anchor
        self.l5_anchor     ||= taxonomy.l5_anchor
      end
    end

    label = skill_label.presence || "this competency"
    self.l1_anchor = l1_anchor.presence || "Demonstrates foundational understanding of #{label} with guidance."
    self.l2_anchor = l2_anchor.presence || "Applies #{label} independently for standard requirements."
    self.l3_anchor = l3_anchor.presence || "Executes complex #{label} tasks proficiently with consistent quality."
    self.l4_anchor = l4_anchor.presence || "Shows advanced mastery of #{label}, guiding peers and optimizing approaches."
    self.l5_anchor = l5_anchor.presence || "Demonstrates expert, strategic command of #{label} across the organization."
  end
end
