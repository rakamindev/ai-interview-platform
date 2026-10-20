# frozen_string_literal: true

puts "== Seeding Demo Completed Session and Portfolio =="

org = Organization.find_by!(scheme: 'test-corp')
admin = User.find_by!(email: 'admin@example.com')

# 1. Ensure a Senior Fullstack assessment exists
assessment = Assessment.find_or_create_by!(
  tenant_id: org.id,
  name: 'Senior Full-Stack Engineer Assessment'
) do |a|
  a.created_by = admin.id
  a.time_limit_min = 45
  a.language = 'en'
end

# Ensure skills on assessment
skills_data = [
  { label: 'React / Frontend Development Core', skill_id: 'SK-ENG-001', exp: 3 },
  { label: 'Node.js / Backend Development', skill_id: 'SK-ENG-002', exp: 4 },
  { label: 'System Design & Architecture', skill_id: 'SK-ENG-003', exp: 3 },
  { label: 'Database Design & SQL', skill_id: 'SK-ENG-004', exp: 3 },
  { label: 'Communication', skill_id: 'SK-SOFT-001', exp: 4 }
]

skills_data.each_with_index do |sd, idx|
  tax = SkillTaxonomy.find_by(skill_id: sd[:skill_id])
  next unless tax

  askill = assessment.assessment_skills.find_or_initialize_by(skill_label: sd[:label])
  askill.assign_attributes(
    skill_id: sd[:skill_id],
    expected_level: sd[:exp],
    display_order: idx,
    scope_include: tax.scope_include,
    scope_exclude: tax.scope_exclude,
    l1_anchor: tax.l1_anchor,
    l2_anchor: tax.l2_anchor,
    l3_anchor: tax.l3_anchor,
    l4_anchor: tax.l4_anchor,
    l5_anchor: tax.l5_anchor
  )
  askill.save!
end

assessment.update!(system_prompt: Assessments::SystemPromptCompiler.new(assessment).call)

# 2. Ensure Vacancy exists
vacancy = Vacancy.find_or_create_by!(
  tenant_id: org.id,
  role_title: 'Senior Full-Stack Engineer'
) do |v|
  v.created_by = admin.id
  v.culture_dimensions = "Ownership, collaborative problem solver, high empathy in code reviews and async communication."
  v.competency_expectations = "Designs scalable APIs, optimizes PostgreSQL queries, leads frontend architectural migrations."
end

skills_data.each do |sd|
  vskill = vacancy.vacancy_skills.find_or_initialize_by(skill_label: sd[:label])
  vskill.skill_id = sd[:skill_id]
  vskill.expected_level = sd[:exp]
  vskill.save!
end

# 3. Create a completed Session
session = Session.find_or_create_by!(
  tenant_id: org.id,
  assessment_id: assessment.id,
  candidate_name: 'Alex Pratama (Demo)'
) do |s|
  s.status = 'ended'
  s.end_reason = 'all_covered'
  s.started_at = 45.minutes.ago
  s.ended_at = 5.minutes.ago
  s.duration_seconds = 2400
end
session.update!(status: 'ended', end_reason: 'all_covered')

# 4. Create Coverage Maps
skills_data.each do |sd|
  cmap = session.coverage_maps.find_or_initialize_by(skill_label: sd[:label])
  cmap.assign_attributes(
    skill_id: sd[:skill_id],
    is_discovered: false,
    state: 'covered',
    probe_count: 3,
    last_signal: 'Demonstrated strong real-world architectural knowledge'
  )
  cmap.save!
end

# 5. Create Transcript Turns
turns_data = [
  { speaker: 'ai', text: "Hi Alex, thanks for joining today. Let's jump in — tell me about the most technically challenging project you've worked on recently." },
  { speaker: 'candidate', text: "Recently I led the migration of our monolith's dashboard to a micro-frontend architecture using React and Vite. We had about 80 developers committing to the same codebase which caused huge deployment bottlenecks." },
  { speaker: 'ai', text: "That sounds like a complex migration. You mentioned micro-frontends — what problems did you face with shared state and how did you isolate team domains?" },
  { speaker: 'candidate', text: "We decided not to share runtime state between micro-apps. Instead, we used lightweight custom browser events and URL query parameters for cross-app coordination. Each team owned their own isolated Jotai atom stores." },
  { speaker: 'ai', text: "Good practical choice. What about backend services? How did you design the API endpoints to support these distributed frontend micro-apps?" },
  { speaker: 'candidate', text: "We implemented a Backend-For-Frontend (BFF) gateway pattern in Node.js with Fastify. It aggregated responses from our internal microservices and returned tailored payloads, reducing mobile payload sizes by 40%." },
  { speaker: 'ai', text: "How did you handle database query performance and transactions across those microservices?" },
  { speaker: 'candidate', text: "For write operations requiring consistency, we used an Outbox pattern with PostgreSQL and Redis queues. On the read side, we added composite indexes on tenant_id and status which brought our p99 query latency down from 450ms to 28ms." },
  { speaker: 'ai', text: "That's a very thoughtful approach — I can see you've dealt with this hands-on. I think I've got a clear picture, thank you for your time. You'll hear back from the team soon." }
]

turns_data.each_with_index do |td, idx|
  turn = session.transcript_turns.find_or_initialize_by(turn_number: idx + 1)
  turn.assign_attributes(
    speaker: td[:speaker],
    text: td[:text],
    audio_start_ms: idx * 5000,
    audio_end_ms: (idx + 1) * 5000
  )
  turn.save!
end

# 6. Create Portfolio & Portfolio Skills
portfolio = Portfolio.find_or_create_by!(session_id: session.id) do |p|
  p.candidate_id = session.candidate_id
  p.generation_status = 'complete'
  p.generated_at = Time.current
end
portfolio.update!(generation_status: 'complete', generated_at: Time.current)

portfolio.portfolio_skills.destroy_all

portfolio_skills_seed = [
  {
    skill_id: 'SK-ENG-001',
    skill_label: 'React / Frontend Development Core',
    ai_level: 4,
    ai_confidence: 'high',
    evidence: [
      "We decided not to share runtime state between micro-apps, instead using custom browser events and URL query parameters.",
      "Each team owned their own isolated Jotai atom stores to avoid runtime coupling."
    ],
    summary: "Demonstrates advanced frontend architectural maturity. Successfully decoupled large monolithic frontend into independently deployable micro-frontends without shared global state anti-patterns."
  },
  {
    skill_id: 'SK-ENG-002',
    skill_label: 'Node.js / Backend Development',
    ai_level: 4,
    ai_confidence: 'high',
    evidence: [
      "We implemented a Backend-For-Frontend (BFF) gateway pattern in Node.js with Fastify.",
      "It aggregated responses from internal microservices and reduced payload sizes by 40%."
    ],
    summary: "Strong backend engineering skills with asynchronous runtimes. Designed high-performance BFF gateways using Fastify and structured payload aggregation."
  },
  {
    skill_id: 'SK-ENG-003',
    skill_label: 'System Design & Architecture',
    ai_level: 3,
    ai_confidence: 'high',
    evidence: [
      "For write operations requiring consistency, we used an Outbox pattern with PostgreSQL and Redis queues."
    ],
    summary: "Solid grasp of distributed systems patterns. Understands event-driven decoupling and data consistency trade-offs."
  },
  {
    skill_id: 'SK-ENG-004',
    skill_label: 'Database Design & SQL',
    ai_level: 3,
    ai_confidence: 'medium',
    evidence: [
      "Added composite indexes on tenant_id and status which brought our p99 query latency down from 450ms to 28ms."
    ],
    summary: "Competent schema and query optimization. Applies indexing strategies effectively to resolve real performance bottlenecks."
  },
  {
    skill_id: 'SK-SOFT-001',
    skill_label: 'Communication',
    ai_level: 4,
    ai_confidence: 'high',
    evidence: [
      "Articulated technical trade-offs between monolithic and micro-frontend architectures with clear rationale."
    ],
    summary: "Articulate and structured communicator. Explains complex technical trade-offs concisely with pragmatic rationale."
  }
]

portfolio_skills_seed.each do |ps|
  portfolio.portfolio_skills.create!(
    skill_id: ps[:skill_id],
    skill_label: ps[:skill_label],
    is_discovered: false,
    ai_level: ps[:ai_level],
    ai_confidence: ps[:ai_confidence],
    evidence: ps[:evidence],
    competency_summary: ps[:summary]
  )
end

# 7. Create Fit/Gap Report
fit_gap = FitGapReport.find_or_initialize_by(
  portfolio_id: portfolio.id,
  vacancy_id: vacancy.id
)

comparisons = [
  { skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core', candidate_level: 4, expected_level: 3, result: 'exceed', delta: 1, confidence: 'high' },
  { skill_id: 'SK-ENG-002', skill_label: 'Node.js / Backend Development', candidate_level: 4, expected_level: 4, result: 'match', delta: 0, confidence: 'high' },
  { skill_id: 'SK-ENG-003', skill_label: 'System Design & Architecture', candidate_level: 3, expected_level: 3, result: 'match', delta: 0, confidence: 'high' },
  { skill_id: 'SK-ENG-004', skill_label: 'Database Design & SQL', candidate_level: 3, expected_level: 3, result: 'match', delta: 0, confidence: 'medium' },
  { skill_id: 'SK-SOFT-001', skill_label: 'Communication', candidate_level: 4, expected_level: 4, result: 'match', delta: 0, confidence: 'high' }
]

fit_gap.update!(
  skill_comparisons: comparisons,
  culture_narrative: "Alex demonstrates strong alignment with our ownership culture. His initiative in refactoring large systems while keeping team DX high shows strong empathy and proactive leadership.",
  overall_narrative: "Strong Hire recommendation. Meets or exceeds all 5 required competency benchmarks for the Senior Full-Stack Engineer role, especially in React architecture and Node.js backend design.",
  generated_at: Time.current
)

puts "== Demo seed complete! Session ID: #{session.id}, Assessment ID: #{assessment.id}, Vacancy ID: #{vacancy.id} =="
