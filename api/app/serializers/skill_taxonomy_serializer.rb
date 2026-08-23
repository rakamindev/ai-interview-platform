# frozen_string_literal: true

class SkillTaxonomySerializer
  def initialize(skill)
    @skill = skill
  end

  def as_json(**)
    {
      skill_id:      skill.skill_id,
      skill_label:   skill.skill_label,
      category:      skill.category,
      scope_include: skill.scope_include,
      scope_exclude: skill.scope_exclude,
      l1_anchor:     skill.l1_anchor,
      l2_anchor:     skill.l2_anchor,
      l3_anchor:     skill.l3_anchor,
      l4_anchor:     skill.l4_anchor,
      l5_anchor:     skill.l5_anchor
    }
  end

  private

  attr_reader :skill
end
