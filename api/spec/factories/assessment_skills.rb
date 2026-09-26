# frozen_string_literal: true

FactoryBot.define do
  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    l1_anchor { 'Needs close guidance.' }
    l2_anchor { 'Handles routine work alone.' }
    l3_anchor { 'Handles complex work and explains trade-offs.' }
    l4_anchor { 'Sets standards others follow.' }
    l5_anchor { 'Shapes how the whole organisation works.' }
    display_order { 0 }
  end
end
