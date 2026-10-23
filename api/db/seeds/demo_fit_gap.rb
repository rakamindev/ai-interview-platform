# frozen_string_literal: true

# Fictional demo data for the evidence-aware fit/gap report. Every name, email
# and quote here is invented. Safe to re-run.
#
#   bundle exec rails db:seed
#   bundle exec rails runner db/seeds/demo_fit_gap.rb
#
# Log in as assessor@example.test / demo-password-123, then open the URLs it prints.

org = Organization.find_by!(scheme: 'test-corp')
Current.organization = org
Current.tenant_id    = org.id

user = User.find_or_initialize_by(email: 'assessor@example.test')
user.update!(password: 'demo-password-123', role: 'admin')

taxonomy = SkillTaxonomy.where(skill_id: %w[SK-ENG-002 SK-ENG-003 SK-ENG-004 SK-ENG-005]).index_by(&:skill_id)
abort 'Run `rails db:seed` first (skill taxonomy missing).' if taxonomy.size < 4

assessment = Assessment.find_or_create_by!(name: 'Backend Engineer — Demo') do |a|
  a.created_by     = user.id
  a.time_limit_min = 30
  a.language       = 'en'
  taxonomy.values.each_with_index do |t, i|
    a.assessment_skills.build(
      skill_id: t.skill_id, skill_label: t.skill_label, display_order: i,
      l1_anchor: t.l1_anchor, l2_anchor: t.l2_anchor, l3_anchor: t.l3_anchor,
      l4_anchor: t.l4_anchor, l5_anchor: t.l5_anchor
    )
  end
end

session = assessment.sessions.find_or_create_by!(candidate_name: 'Demo Candidate') do |s|
  s.status           = 'ended'
  s.end_reason       = 'all_covered'
  s.started_at       = 40.minutes.ago
  s.ended_at         = 12.minutes.ago
  s.duration_seconds = 28 * 60
end

portfolio = session.portfolio || session.create_portfolio!(generation_status: 'complete', generated_at: 10.minutes.ago)
portfolio.update!(generation_status: 'complete')

if portfolio.portfolio_skills.none?
  [
    ['SK-ENG-004', 3, 'high',   ['I added a partial index once the status filter dominated the query plan.',
                                 'We ran the backfill in batches so the migration never held a long lock.']],
    ['SK-ENG-003', 2, 'low',    ['I would probably put a queue in front of it.']],
    ['SK-ENG-005', 4, 'medium', ['We versioned the error contract so mobile clients could upgrade on their own schedule.']],
    ['SK-ENG-002', 2, 'high',   ['I usually follow the existing middleware pattern in the codebase.',
                                 'Background jobs were set up by another team, I mostly call them.']]
  ].each do |skill_id, level, confidence, quotes|
    portfolio.portfolio_skills.create!(
      skill_id: skill_id, skill_label: taxonomy[skill_id].skill_label, is_discovered: false,
      ai_level: level, ai_confidence: confidence, evidence: quotes,
      competency_summary: 'Fictional summary for demo purposes.'
    )
  end

  portfolio.portfolio_skills.create!(
    skill_label: 'Incident Response', is_discovered: true, ai_level: 3, ai_confidence: 'medium',
    evidence: ['I wrote the runbook after the second outage.'],
    competency_summary: 'Fictional summary for demo purposes.'
  )
end

vacancy = Vacancy.find_or_create_by!(role_title: 'Senior Backend Engineer') do |v|
  v.created_by = user.id
  v.culture_dimensions = 'Writes things down; owns outcomes end to end; calm in incidents.'
  [['SK-ENG-004', 3], ['SK-ENG-003', 4], ['SK-ENG-005', 3], ['SK-ENG-002', 3]].each do |skill_id, level|
    v.vacancy_skills.build(skill_id: skill_id, skill_label: taxonomy[skill_id].skill_label, expected_level: level)
  end
  v.vacancy_skills.build(skill_label: 'Kubernetes & Container Orchestration', expected_level: 2)
end

empty_vacancy = Vacancy.find_or_create_by!(role_title: 'Data Analyst (draft)') { |v| v.created_by = user.id }

# A report stored before verdicts were evidence-aware: it calls the briefly
# explored System Design skill a gap. Opening the report recomputes it.
FitGapReport.find_or_create_by!(portfolio: portfolio, vacancy: vacancy) do |r|
  r.comparator_version = nil
  r.skill_comparisons  = [{ skill_label: taxonomy['SK-ENG-003'].skill_label, expected_level: 4,
                            candidate_level: 2, result: 'gap', delta: -2 }]
  r.overall_narrative  = 'Candidate shows 1 skill matches, 1 exceeds, and 2 gaps against role requirements.'
end

base = "/assessments/#{assessment.id}/sessions/#{session.id}"
puts "Demo ready. Log in as assessor@example.test / demo-password-123"
puts "  Portfolio:            #{base}/portfolio"
puts "  Fit/gap:              #{base}/fitgap/#{vacancy.id}"
puts "  Fit/gap (no reqs):    #{base}/fitgap/#{empty_vacancy.id}"
