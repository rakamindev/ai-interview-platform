# frozen_string_literal: true

module SkillHelpers
  def skill_attributes(**overrides)
    {
      skill_label: 'Test Skill', is_custom: true, expected_level: 3, display_order: 0,
      l1_anchor: 'Level 1 behaviour', l2_anchor: 'Level 2 behaviour', l3_anchor: 'Level 3 behaviour',
      l4_anchor: 'Level 4 behaviour', l5_anchor: 'Level 5 behaviour'
    }.merge(overrides)
  end
end

RSpec.configure do |config|
  config.include SkillHelpers
end
