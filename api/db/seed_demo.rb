# frozen_string_literal: true
require 'securerandom'

Current.tenant_id = 1

user = User.find_or_initialize_by(email: 'admin@rakamin.com')
default_pass = ENV.fetch('ADMIN_PASSWORD', 'Admin@123456')
user.password = default_pass
user.password_confirmation = default_pass
user.role = 'admin'
user.save!
puts "Admin user ready: #{user.email}"

assessment = Assessment.find_by(name: 'Senior Fullstack Engineer Assessment') || Assessment.new(name: 'Senior Fullstack Engineer Assessment')
assessment.time_limit_min = 45
assessment.language = 'en'
assessment.tenant_id = 1
assessment.created_by = user.id
assessment.save!
puts "Assessment ready: #{assessment.id} — #{assessment.name}"

skills_config = [
  { skill_id: 'SK-ENG-001', label: 'React / Frontend Development Core', level: 4 },
  { skill_id: 'SK-ENG-002', label: 'Node.js / Backend Development', level: 4 },
  { skill_id: 'SK-ENG-003', label: 'System Design & Architecture', level: 4 },
  { skill_id: 'SK-SOFT-001', label: 'Communication', level: 4 }
]

skills_config.each_with_index do |cfg, idx|
  tax = SkillTaxonomy.find_by(skill_id: cfg[:skill_id])
  askill = AssessmentSkill.find_by(assessment: assessment, skill_id: cfg[:skill_id]) || AssessmentSkill.new(assessment: assessment, skill_id: cfg[:skill_id])
  askill.skill_label = cfg[:label]
  askill.expected_level = cfg[:level]
  askill.display_order = idx + 1
  askill.l1_anchor = tax&.l1_anchor || 'Fundamental comprehension'
  askill.l2_anchor = tax&.l2_anchor || 'Working ability with guidance'
  askill.l3_anchor = tax&.l3_anchor || 'Independent professional execution'
  askill.l4_anchor = tax&.l4_anchor || 'Advanced domain mastery'
  askill.l5_anchor = tax&.l5_anchor || 'Industry expert & architectural authority'
  askill.save!
end

# Vacancy for fit/gap
vacancy = Vacancy.find_by(role_title: 'Senior Frontend Specialist') || Vacancy.new(role_title: 'Senior Frontend Specialist')
vacancy.tenant_id = 1
vacancy.created_by = user.id
vacancy.save!

VacancySkill.find_or_create_by!(vacancy: vacancy, skill_label: 'React / Frontend Development Core') { |vs| vs.skill_id = 'SK-ENG-001'; vs.expected_level = 4 }
VacancySkill.find_or_create_by!(vacancy: vacancy, skill_label: 'System Design & Architecture') { |vs| vs.skill_id = 'SK-ENG-003'; vs.expected_level = 3 }

# Session 1: Budi Santoso (completed)
s1 = Session.find_or_initialize_by(assessment: assessment, candidate_id: 101)
s1.invite_token ||= SecureRandom.hex(16)
s1.candidate_name = 'Budi Santoso'
s1.tenant_id = 1
s1.status = 'ended'
s1.end_reason = 'all_covered'
s1.duration_seconds = 2450
s1.started_at = 2.hours.ago
s1.ended_at = 1.hour.ago
s1.integrity_metadata = {
  device_state: 'Chrome 128 / macOS 14.5 / Camera & Mic passed',
  connection_health: 'stable (avg 18ms latency, 0 drops)',
  reconnect_events: 0,
  audio_quality: 'clear, 48kHz stereo'
}
s1.save!

p1 = Portfolio.find_by(session: s1) || Portfolio.new(session: s1)
p1.candidate_id = s1.candidate_id
p1.generation_status = 'complete'
p1.save!

ps1 = PortfolioSkill.find_by(portfolio: p1, skill_label: 'React / Frontend Development Core') || PortfolioSkill.new(portfolio: p1, skill_label: 'React / Frontend Development Core')
ps1.skill_id = 'SK-ENG-001'
ps1.ai_level = 4
ps1.ai_confidence = 'high'
ps1.competency_summary = 'Strong understanding of React state management, hooks, and virtual DOM rendering pipelines.'
ps1.evidence = [
  'Articulated custom hooks abstraction, state colocation, and suspense boundaries clearly in turn 6.',
  'Identified re-render bottlenecks using React Profiler with concrete memoization strategies.'
]
ps1.counter_evidence = []
ps1.save!

ps2 = PortfolioSkill.find_by(portfolio: p1, skill_label: 'System Design & Architecture') || PortfolioSkill.new(portfolio: p1, skill_label: 'System Design & Architecture')
ps2.skill_id = 'SK-ENG-003'
ps2.ai_level = 3
ps2.ai_confidence = 'medium'
ps2.competency_summary = 'Clear grasp of service modularization and caching, with slight gaps on distributed consensus.'
ps2.evidence = [
  'Proposed clean layered architecture separating business domains from transport adapters.'
]
ps2.counter_evidence = [
  'Did not address event-driven consistency under multi-region replication partitions.'
]
ps2.save!

# Fit/gap report for Budi Santoso against Vacancy 1
fg = FitGapReport.find_by(portfolio: p1, vacancy: vacancy) || FitGapReport.new(portfolio: p1, vacancy: vacancy)
fg.overall_narrative = 'Strong alignment with core frontend competencies and architecture requirements.'
fg.skill_comparisons = [
  { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React / Frontend Development Core', 'expected_level' => 4, 'actual_level' => 4, 'fit_result' => 'match', 'notes' => 'Matches expected depth in frontend systems.' },
  { 'skill_id' => 'SK-ENG-003', 'skill_label' => 'System Design & Architecture', 'expected_level' => 3, 'actual_level' => 3, 'fit_result' => 'match', 'notes' => 'Demonstrated solid grasp of modular systems.' }
]
fg.save!

# Session 2: Siti Rahma (pending)
s2 = Session.find_or_initialize_by(assessment: assessment, candidate_id: 102)
s2.invite_token ||= SecureRandom.hex(16)
s2.candidate_name = 'Siti Rahma'
s2.tenant_id = 1
s2.status = 'pending'
s2.integrity_metadata = {}
s2.save!

# Session 3: Andi Pratama (completed)
s3 = Session.find_or_initialize_by(assessment: assessment, candidate_id: 103)
s3.invite_token ||= SecureRandom.hex(16)
s3.candidate_name = 'Andi Pratama'
s3.tenant_id = 1
s3.status = 'ended'
s3.end_reason = 'all_covered'
s3.duration_seconds = 2100
s3.started_at = 4.hours.ago
s3.ended_at = 3.hours.ago
s3.integrity_metadata = { device_state: 'Chrome 128 / Windows 11', connection_health: 'stable', reconnect_events: 0 }
s3.save!

p3 = Portfolio.find_by(session: s3) || Portfolio.new(session: s3)
p3.candidate_id = s3.candidate_id
p3.generation_status = 'complete'
p3.save!

ps3 = PortfolioSkill.find_by(portfolio: p3, skill_label: 'React / Frontend Development Core') || PortfolioSkill.new(portfolio: p3, skill_label: 'React / Frontend Development Core')
ps3.skill_id = 'SK-ENG-001'
ps3.ai_level = 5
ps3.ai_confidence = 'high'
ps3.competency_summary = 'Mastery level performance across state machines, custom renderers, and micro-frontend federation.'
ps3.evidence = ['Demonstrated advanced state machines and server-side rendering optimizations.']
ps3.counter_evidence = []
ps3.save!

puts 'Demo dataset seeded successfully into development DB!'
