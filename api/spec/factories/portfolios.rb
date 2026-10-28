# frozen_string_literal: true

FactoryBot.define do
  factory :portfolio do
    session
    generation_status { 'complete' }
    generated_at      { Time.current }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Contoh Skill #{n}" }
    is_discovered      { false }
    ai_level           { 3 }
    ai_confidence      { 'high' }
    evidence           { ['Kandidat Contoh: contoh kutipan.'] }
    competency_summary { 'Contoh ringkasan kompetensi.' }
  end

  factory :assessor_override do
    portfolio_skill
    ai_level       { portfolio_skill.ai_level }
    override_level { 4 }
    assessor_notes { 'Contoh catatan asesor.' }
    overridden_by  { 1 }
    overridden_at  { Time.current }
  end
end
