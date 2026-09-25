# frozen_string_literal: true

class AssessmentSkill < ApplicationRecord
  belongs_to :assessment, inverse_of: :assessment_skills

  before_validation :set_default_anchors

  validates :skill_label, presence: true
  validates :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor, presence: true
  validates :display_order, presence: true
  validates :expected_level, numericality: { only_integer: true,
                                              in: 1..5,
                                              allow_nil: true }

  private

  def set_default_anchors
    if skill_id.present?
      taxonomy = SkillTaxonomy.find_by(skill_id:)
      if taxonomy
        self.scope_include = scope_include.presence || taxonomy.scope_include
        self.scope_exclude = scope_exclude.presence || taxonomy.scope_exclude
        self.l1_anchor = l1_anchor.presence || taxonomy.l1_anchor
        self.l2_anchor = l2_anchor.presence || taxonomy.l2_anchor
        self.l3_anchor = l3_anchor.presence || taxonomy.l3_anchor
        self.l4_anchor = l4_anchor.presence || taxonomy.l4_anchor
        self.l5_anchor = l5_anchor.presence || taxonomy.l5_anchor
      end
    end

    label = skill_label.presence || 'Competency'
    self.l1_anchor = l1_anchor.presence || "Basic awareness and fundamental conceptual understanding of #{label}."
    self.l2_anchor = l2_anchor.presence || "Novice application and practical execution of #{label}."
    self.l3_anchor = l3_anchor.presence || "Independent proficiency and standard problem solving in #{label}."
    self.l4_anchor = l4_anchor.presence || "Advanced proficiency and complex troubleshooting in #{label}."
    self.l5_anchor = l5_anchor.presence || "Expert mastery, strategic architecture, and domain leadership in #{label}."
    self.scope_include = scope_include.presence || "Practical understanding, execution, and evaluation of #{label}."
  end
end
