# frozen_string_literal: true

# Development-only demo data for the candidate invite flow.
# 
#   bundle exec rails runner db/seeds_demo.rb

org = Organization.find_by(scheme: 'test-corp')
raise 'Run db:seed first (test-corp organization missing)' unless org

# Local-only assessor login for the demo. Override with DEMO_ASSESSOR_PASSWORD;
# this account only exists in a development database created by this seed.
demo_email = ENV.fetch('DEMO_ASSESSOR_EMAIL', 'assessor@example.test')
demo_password = ENV.fetch('DEMO_ASSESSOR_PASSWORD', 'demo-password-123')

assessor = User.find_or_initialize_by(email: demo_email)
assessor.assign_attributes(
  password: demo_password,
  password_confirmation: demo_password,
  role: 'assessor'
)
assessor.save!

Assessment.where(tenant_id: org.id, name: 'Senior Frontend Engineer').find_each do |old|
  # Fit/gap reports reference portfolios without an ON DELETE cascade, so they
  # must be cleared explicitly before the sessions (and their portfolios) go.
  FitGapReport.where(
    portfolio_id: Portfolio.where(session_id: old.sessions.select(:id)).select(:id)
  ).delete_all
  old.sessions.destroy_all
  old.destroy
end

assessment = Assessment.create!(
  tenant_id:      org.id,
  created_by:     assessor.id,
  name:           'Senior Frontend Engineer',
  time_limit_min: 45,
  language:       'en'
)

skill_ids = %w[SK-ENG-001 SK-SOFT-001 SK-ENG-003]
taxonomies = SkillTaxonomy.where(skill_id: skill_ids).index_by(&:skill_id)

skill_ids.each_with_index do |skill_id, index|
  taxonomy = taxonomies.fetch(skill_id)
  assessment.assessment_skills.create!(
    skill_id:      taxonomy.skill_id,
    skill_label:   taxonomy.skill_label,
    is_custom:     false,
    scope_include: taxonomy.scope_include,
    scope_exclude: taxonomy.scope_exclude,
    l1_anchor:     taxonomy.l1_anchor,
    l2_anchor:     taxonomy.l2_anchor,
    l3_anchor:     taxonomy.l3_anchor,
    l4_anchor:     taxonomy.l4_anchor,
    l5_anchor:     taxonomy.l5_anchor,
    expected_level: 3,
    display_order: index
  )
end

def make_session(assessment, name, attrs = {})
  session = assessment.sessions.create!(
    tenant_id:      assessment.tenant_id,
    candidate_name: name,
    status:         attrs.delete(:status) || 'pending'
  )
  session.update_columns(attrs) if attrs.any?
  session
end

# 1. Fresh, usable invite
fresh = make_session(assessment, 'Ahmad Rizky')

# 2. Expired invite
expired = make_session(assessment, 'Siti Rahma')
expired.update_columns(invite_expires_at: 2.days.ago)

# 3. Revoked invite
revoked = make_session(assessment, 'Dewi Lestari')
revoked.update_columns(invite_revoked_at: 3.hours.ago)

# 4. Live interview
live = make_session(assessment, 'Rizky Pratama', status: 'active')
live.update_columns(
  started_at: 12.minutes.ago,
  consent_given_at: 13.minutes.ago
)
assessment.assessment_skills.order(:display_order).each_with_index do |skill, i|
  live.coverage_maps.create!(
    skill_id: skill.skill_id,
    skill_label: skill.skill_label,
    state: i.zero? ? 'covered' : (i == 1 ? 'partial' : 'not_yet'),
    probe_count: i.zero? ? 4 : (i == 1 ? 2 : 0)
  )
end

# 5. Completed interview with a portfolio and fit/gap report
done = make_session(assessment, 'Budi Santoso', status: 'ended')
done.update_columns(
  started_at: 2.days.ago,
  ended_at: 2.days.ago + 38.minutes,
  duration_seconds: 38 * 60,
  end_reason: 'all_covered',
  consent_given_at: 2.days.ago
)
assessment.assessment_skills.order(:display_order).each_with_index do |skill, i|
  done.coverage_maps.create!(
    skill_id: skill.skill_id,
    skill_label: skill.skill_label,
    state: 'covered',
    probe_count: 4 + i
  )
end

turns = [
  ['ai',        'Tell me about the most technically challenging frontend project you worked on recently.'],
  ['candidate', 'We built a real-time logistics dashboard handling hundreds of updates per second.'],
  ['ai',        'How were you managing that state, and what was breaking before you fixed it?'],
  ['candidate', 'Redux was re-rendering the whole dashboard. We moved ephemeral data into local state and used React.memo.'],
  ['ai',        'How did you decide where to draw the line between Redux and local state?'],
  ['candidate', 'Anything shared or persisted stayed in Redux; transient UI state stayed local.'],
  ['ai',        'Walk me through how you handled disagreement about that architecture.'],
  ['candidate', 'I wrote a one-pager with profiler data and framed it as a performance risk, not a preference.']
]

turns.each_with_index do |(speaker, text), i|
  done.transcript_turns.create!(turn_number: i + 1, speaker: speaker, text: text)
end

portfolio = done.create_portfolio!(
  generation_status: 'complete',
  generated_at: 2.days.ago + 41.minutes
)

portfolio.portfolio_skills.create!(
  skill_label: 'React / Frontend Development Core',
  skill_id: 'SK-ENG-001',
  is_discovered: false,
  ai_level: 3,
  ai_confidence: 'high',
  evidence: [
    'We moved ephemeral data into local state and used React.memo aggressively.',
    'Anything shared or persisted stayed in Redux; transient UI state stayed local.'
  ],
  competency_summary: 'Handles complex state architecture with clear trade-off reasoning and owns performance work end-to-end.'
)

portfolio.portfolio_skills.create!(
  skill_label: 'Communication',
  skill_id: 'SK-SOFT-001',
  is_discovered: false,
  ai_level: 2,
  ai_confidence: 'medium',
  evidence: [
    'I wrote a one-pager with profiler data and framed it as a performance risk.'
  ],
  competency_summary: 'Communicates clearly in technical settings but described a reactive rather than systematic approach to async updates.'
)

portfolio.portfolio_skills.create!(
  skill_label: 'System Design & Architecture',
  skill_id: 'SK-ENG-003',
  is_discovered: false,
  ai_level: 3,
  ai_confidence: 'high',
  evidence: [
    'We kept anything shared or persisted in Redux and isolated transient UI state.'
  ],
  competency_summary: 'Leads with data contracts and clear boundaries; strong frontend architecture thinking.'
)

portfolio.portfolio_skills.create!(
  skill_label: 'Micro-frontend Architecture',
  is_discovered: true,
  ai_level: 2,
  ai_confidence: 'low',
  evidence: ['We decomposed the app into micro-frontends when the team grew.'],
  competency_summary: 'Has hands-on exposure but only briefly explored; insufficient signal for a confident rating.'
)

vacancy = Vacancy.find_or_initialize_by(tenant_id: org.id, role_title: 'Senior Frontend Engineer (TechCorp)')
vacancy.assign_attributes(created_by: assessor.id, culture_dimensions: 'ownership, directness, async-first culture')
vacancy.save!
vacancy.vacancy_skills.destroy_all
[
  ['SK-ENG-001', 'React / Frontend Development Core', 3],
  ['SK-SOFT-001', 'Communication', 3],
  ['SK-ENG-003', 'System Design & Architecture', 2]
].each do |skill_id, label, level|
  vacancy.vacancy_skills.create!(skill_id: skill_id, skill_label: label, expected_level: level)
end

FitGapReport.find_or_initialize_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id).update!(
  skill_comparisons: [
    { skill_label: 'React / Frontend Development Core', skill_id: 'SK-ENG-001', candidate_level: 3, expected_level: 3, result: 'match', delta: 0, confidence: 'high' },
    { skill_label: 'Communication', skill_id: 'SK-SOFT-001', candidate_level: 2, expected_level: 3, result: 'gap', delta: -1, confidence: 'medium' },
    { skill_label: 'System Design & Architecture', skill_id: 'SK-ENG-003', candidate_level: 3, expected_level: 2, result: 'exceed', delta: 1, confidence: 'high' }
  ],
  culture_narrative: "Budi's ownership mindset and performance-first reasoning align with TechCorp's engineering culture. The communication gap at L2 versus the required L3 is the primary area to probe in a hiring conversation.",
  overall_narrative: 'Strong technical match with one level gap in communication. Recommend advancing with a focused follow-up on stakeholder communication.',
  generated_at: 2.days.ago + 42.minutes
)

# 6. Failed interview (transcript should still be reachable)
failed = make_session(assessment, 'Nadia Putri', status: 'ended')
failed.update_columns(
  started_at: 1.day.ago,
  ended_at: 1.day.ago + 4.minutes,
  duration_seconds: 4 * 60,
  end_reason: 'error',
  consent_given_at: 1.day.ago
)
failed.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Hi Nadia, thanks for joining today.')
failed.transcript_turns.create!(turn_number: 2, speaker: 'candidate', text: 'Thanks — happy to be here.')

puts '== Demo data ready =='
puts "Assessment: #{assessment.name} (id=#{assessment.id})"
puts "Sessions:"
assessment.sessions.order(:id).each do |s|
  puts format('  %-14s %-8s %-10s %s', s.candidate_name, s.status, s.invite_status, s.invite_url)
end
puts "Vacancy: #{vacancy.role_title} (id=#{vacancy.id})"
puts "Assessor login: #{demo_email} / #{demo_password} (development only)"