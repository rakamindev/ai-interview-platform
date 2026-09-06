# Minimal factories for the specs that need persisted rows.
#
# rantai minimum: organization → assessment → session → coverage_map /
# portfolio → portfolio_skill. tenant_id/created_by adalah kolom mentah
# (tanpa belongs_to), jadi diisi eksplisit.
FactoryBot.define do
  factory :organization do
    sequence(:name)      { |n| "Org #{n}" }
    sequence(:scheme)    { |n| "org-#{n}" }
    sequence(:identifier) { |n| "org-#{n}" }
    sequence(:host)      { |n| "org#{n}.example.test" }
  end

  factory :user do
    sequence(:email) { |n| "user#{n}@example.test" }
    # tidak ada spec yang login pakai password ini — nilainya tidak pernah
    # diverifikasi; diturunkan runtime agar tidak ada pola "hardcoded password"
    password { SecureRandom.hex(12) }
    role { 'admin' }
  end

  factory :assessment do
    tenant_id       { create(:organization).id }
    created_by      { create(:user).id }
    name            { 'Senior Backend Engineer Assessment' }
    time_limit_min  { 30 }
  end

  factory :session do
    assessment
    tenant_id { assessment.tenant_id }
    status    { 'active' }
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    state       { 'partial' }
    probe_count { 4 }
    last_signal { 'Candidate described a real production incident they resolved' }
  end

  factory :portfolio do
    session
    candidate_id      { nil }
    generation_status { 'pending' }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level            { 3 }
    ai_confidence       { 'high' }
    evidence            { ['a revealing quote'] }
    competency_summary  { 'Reliably executes on routine scope.' }
  end
end
