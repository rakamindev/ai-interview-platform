# Demo data for UI walkthrough (dev DB, test-corp tenant).
org_id = ActiveRecord::Base.connection.select_value(
  "SELECT id FROM public.organizations WHERE scheme = 'test-corp' LIMIT 1"
)
abort 'org test-corp not found — run db:seed first' unless org_id

taxonomy = SkillTaxonomy.order(:id).limit(3)
abort 'skill taxonomy empty — run db:seed first' if taxonomy.empty?

assessment = Assessment.create!(
  tenant_id: org_id,
  created_by: 1,
  name: 'Senior Frontend Engineer — Pilot',
  time_limit_min: 30,
  language: 'en'
)

taxonomy.each do |t|
  assessment.assessment_skills.create!(
    skill_id: t.skill_id,
    skill_label: t.skill_label,
    is_custom: false,
    expected_level: 3,
    display_order: 0,
    l1_anchor: t.l1_anchor, l2_anchor: t.l2_anchor, l3_anchor: t.l3_anchor,
    l4_anchor: t.l4_anchor, l5_anchor: t.l5_anchor
  )
end

session = assessment.sessions.create!(
  tenant_id: org_id,
  status: 'ended',
  started_at: 2.hours.ago,
  ended_at: 1.hour.ago,
  duration_seconds: 1800
)

portfolio = session.create_portfolio!(
  generation_status: 'complete',
  generated_at: Time.current
)

def anchor_quarter(label)
  ["Candidate walked through a real #{label} decision they owned end to end",
   "Explained the tradeoff they rejected and why",
   'Showed how they teach this to juniors in code review']
end

skills = [
  { skill_id: taxonomy[0].skill_id, skill_label: taxonomy[0].skill_label, is_discovered: false,
    ai_level: 3, ai_confidence: 'high', evidence: anchor_quarter(taxonomy[0].skill_label),
    competency_summary: 'Reliably executes complex frontend scope; consistent depth in edge cases.' },
  # kasus yang diperbaiki #3: AI tidak menghasilkan level -> NULL (bukan L1)
  { skill_id: taxonomy[1].skill_id, skill_label: taxonomy[1].skill_label, is_discovered: false,
    ai_level: nil, ai_confidence: 'medium', evidence: ['Only one probing exchange reached this skill'],
    competency_summary: 'Discussed briefly near the end; not enough evidence for a confident level.' },
  { skill_id: taxonomy[2].skill_id, skill_label: taxonomy[2].skill_label, is_discovered: false,
    ai_level: 2, ai_confidence: 'medium', evidence: anchor_quarter(taxonomy[2].skill_label).first(2),
    competency_summary: 'Independent on routine scope; ceiling not yet probed.' },
  # discovered + low confidence
  { skill_id: nil, skill_label: 'Prompt Caching Architecture', is_discovered: true,
    ai_level: 4, ai_confidence: 'low', evidence: ['Mentioned token caching strategy unprompted'],
    competency_summary: 'Showed brief but strong instincts; barely explored.' }
]

skills.each do |attrs|
  portfolio.portfolio_skills.create!(attrs)
end

token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' })

puts "ORG_ID=#{org_id}"
puts "ASSESSMENT_ID=#{assessment.id}"
puts "SESSION_ID=#{session.id}"
puts "PORTFOLIO_ID=#{portfolio.id}"
puts "JWT=#{token}"
