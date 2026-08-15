# frozen_string_literal: true

# Demo data for local development, screenshots and the video walkthrough.
#
#   bundle exec rails runner db/seeds/demo.rb
#
# db/seeds.rb creates only the organization and the 22 pilot skill taxonomies,
# so a fresh database has no assessment, session, transcript or portfolio —
# nothing to look at and nothing to record. This builds a complete, finished
# assessment end to end.
#
# The centrepiece is 'Incident Response': it is left in coverage state not_yet
# with probe_count 0. Under the old implementation it arrived in the candidate's
# report as L1 — the lowest possible rating — and then as a hard gap against the
# vacancy. It is the single most useful thing to have on screen.
#
# Idempotent. Safe to re-run.

require 'securerandom'

ORG_SCHEME = 'test-corp'

organization = Organization.find_by(scheme: ORG_SCHEME)
abort("Run `rails db:seed` first — organization '#{ORG_SCHEME}' not found.") unless organization

Current.organization = organization
Current.tenant_id    = organization.id

puts "== Seeding demo assessment for #{organization.name} =="

ANCHORS = {
  l1_anchor: 'Executes with explicit guidance and close review. Understands conceptually but cannot apply independently.',
  l2_anchor: 'Executes independently on routine scope. Uses known patterns. Handles common cases but not edge cases.',
  l3_anchor: 'Executes complex, ambiguous scope. Makes tradeoffs. Handles edge cases. Can teach L1-L2.',
  l4_anchor: 'Defines standards and creates reusable systems. Resolves systemic problems. Cross-team impact.',
  l5_anchor: 'Org-level authority. Shapes how the skill is practiced. Rare.'
}.freeze

SKILLS = [
  { skill_id: 'sk-eng-001', skill_label: 'Distributed Systems',
    scope_include: 'Partitioning, replication, consistency tradeoffs, failure handling.',
    state: 'covered',   probes: 4, level: 3, confidence: 'high' },
  { skill_id: 'sk-eng-002', skill_label: 'Data Modelling',
    scope_include: 'Schema design, normalisation tradeoffs, migration safety.',
    state: 'covered',   probes: 3, level: 2, confidence: 'high' },
  { skill_id: 'sk-eng-003', skill_label: 'API Design',
    scope_include: 'Contract design, versioning, backward compatibility.',
    state: 'partial',   probes: 2, level: 3, confidence: 'medium' },
  { skill_id: 'sk-eng-004', skill_label: 'Testing Strategy',
    scope_include: 'Test boundaries, fixtures, what is worth asserting.',
    state: 'initiated', probes: 1, level: nil, confidence: nil },
  # The skill nobody asked about.
  { skill_id: 'sk-eng-005', skill_label: 'Incident Response',
    scope_include: 'On-call practice, triage, blameless postmortems.',
    state: 'not_yet',   probes: 0, level: nil, confidence: nil }
].freeze

assessment = Assessment.find_or_create_by!(name: 'Senior Backend Engineer — Demo') do |a|
  a.created_by     = 1
  a.time_limit_min = 45
  a.language       = 'en'
end

SKILLS.each_with_index do |skill, index|
  AssessmentSkill.find_or_create_by!(assessment: assessment, skill_label: skill[:skill_label]) do |s|
    s.skill_id       = skill[:skill_id]
    s.scope_include  = skill[:scope_include]
    s.expected_level = 3
    s.display_order  = index
    ANCHORS.each { |k, v| s.public_send("#{k}=", v) }
  end
end
puts "  Assessment ##{assessment.id} with #{assessment.assessment_skills.count} skills"

session = Session.find_or_create_by!(assessment: assessment, candidate_name: 'Budi Santoso') do |s|
  s.status           = 'ended'
  s.end_reason       = 'manual_candidate'
  s.started_at       = 2.hours.ago
  s.ended_at         = 75.minutes.ago
  s.duration_seconds = 2_700
  s.invite_token     = SecureRandom.hex(32)
end
puts "  Session ##{session.id} (candidate name is synthetic)"

TRANSCRIPT = [
  ['ai', 'Tell me about a system you own where the write path became a bottleneck.'],
  ['candidate', 'Our ledger service. Single Postgres primary, and around eighty thousand writes a minute we started seeing lock contention on the balances table.'],
  ['ai', 'What did you try first?'],
  ['candidate', 'I measured before changing anything. Turned out ninety percent of the contention was one hot row per merchant, not the table.'],
  ['ai', 'So what did you change?'],
  ['candidate', 'Sharded by merchant and moved the read side onto a replica. I would not do that rollout again without a kill switch — we had no way to fall back for about forty minutes.'],
  ['ai', 'What did the replica lag cost you?'],
  ['candidate', 'Merchants saw stale balances for a second or two. We decided that was acceptable for display but never for authorisation, so authorisation still reads the primary.'],
  ['ai', 'How do you decide when a schema needs to change versus when the query does?'],
  ['candidate', 'Usually I try the query first because it is reversible. If I am adding an index for a third access pattern on the same table, that is normally the schema telling me the model is wrong.'],
  ['ai', 'Walk me through a migration you were nervous about.'],
  ['candidate', 'Splitting a column into two on a table with about four hundred million rows. We backfilled in batches behind a feature flag and dual-wrote for a week before cutting reads over.'],
  ['ai', 'How do you version an API that external partners depend on?'],
  ['candidate', 'We add fields, we never repurpose them. If something has to break we run both versions and give partners a deprecation window — usually two release cycles.'],
  ['ai', 'How do you decide what to test?'],
  ['candidate', 'I test the things that would be expensive to get wrong. Money movement, permissions. I do not write many tests for glue code.']
].freeze

if session.transcript_turns.empty?
  TRANSCRIPT.each_with_index do |(speaker, text), index|
    TranscriptTurn.create!(
      session: session, turn_number: index + 1, speaker: speaker, text: text,
      audio_start_ms: index * 12_000, audio_end_ms: (index * 12_000) + 9_500
    )
  end
end
puts "  #{session.transcript_turns.count} transcript turns"

SKILLS.each do |skill|
  CoverageMap.find_or_create_by!(session: session, skill_label: skill[:skill_label]) do |m|
    m.skill_id      = skill[:skill_id]
    m.is_discovered = false
    m.state         = skill[:state]
    m.probe_count   = skill[:probes]
    m.last_signal   = skill[:probes].zero? ? nil : 'Candidate gave a concrete, first-hand example.'
  end
end

CoverageMap.find_or_create_by!(session: session, skill_label: 'Database Migration Safety') do |m|
  m.skill_id      = nil
  m.is_discovered = true
  m.state         = 'covered'
  m.probe_count   = 2
  m.last_signal   = 'Raised unprompted while describing a column split.'
end
puts "  #{session.coverage_maps.count} coverage entries (1 left never probed, 1 discovered)"

portfolio = Portfolio.find_or_create_by!(session: session) do |p|
  p.generation_status = 'complete'
  p.generated_at      = 70.minutes.ago
end

EVIDENCE = {
  'Distributed Systems' => ['I measured before changing anything.',
                            'I would not do that rollout again without a kill switch.'],
  'Data Modelling'      => ['Usually I try the query first because it is reversible.',
                            'That is normally the schema telling me the model is wrong.'],
  'API Design'          => ['We add fields, we never repurpose them.']
}.freeze

SKILLS.each do |skill|
  attrs =
    if skill[:level]
      { assessment_state: 'assessed', ai_level: skill[:level], ai_confidence: skill[:confidence],
        evidence: EVIDENCE.fetch(skill[:skill_label], []),
        competency_summary: "Applies #{skill[:skill_label].downcase} independently and reasons about " \
                            'tradeoffs under production constraints.' }
    elsif skill[:state] == 'not_yet'
      { assessment_state: 'not_probed', ai_level: nil, ai_confidence: nil, evidence: [],
        competency_summary: "Not assessed. #{skill[:skill_label]} was not raised during this interview, " \
                            'so there is no evidence on which to base a rating.' }
    else
      { assessment_state: 'insufficient_evidence', ai_level: nil, ai_confidence: nil, evidence: [],
        competency_summary: "Insufficient evidence. #{skill[:skill_label]} was discussed across " \
                            "#{skill[:probes]} probe(s) but the exchange did not support a defensible rating." }
    end

  PortfolioSkill.find_or_create_by!(portfolio: portfolio, skill_label: skill[:skill_label]) do |ps|
    ps.skill_id      = skill[:skill_id]
    ps.is_discovered = false
    attrs.each { |k, v| ps.public_send("#{k}=", v) }
  end
end

PortfolioSkill.find_or_create_by!(portfolio: portfolio, skill_label: 'Database Migration Safety') do |ps|
  ps.skill_id           = nil
  ps.is_discovered      = true
  ps.assessment_state   = 'assessed'
  ps.ai_level           = 4
  ps.ai_confidence      = 'medium'
  ps.evidence           = ['We backfilled in batches behind a feature flag and dual-wrote for a week.']
  ps.competency_summary = 'Treats migrations as a rollout problem rather than a schema problem. ' \
                          'Reaches for reversibility before speed.'
end
puts "  Portfolio ##{portfolio.id} with #{portfolio.portfolio_skills.count} skills"

# A human disagreeing with the model — this is what regeneration used to erase.
data_modelling = portfolio.portfolio_skills.find_by(skill_label: 'Data Modelling')
if data_modelling && data_modelling.assessor_override.nil?
  AssessorOverride.create!(
    portfolio_skill: data_modelling, ai_level: data_modelling.ai_level, override_level: 4,
    assessor_notes: 'The batched backfill and dual-write answer is L4 behaviour. The model under-rated this.',
    overridden_by: 1, overridden_at: 60.minutes.ago
  )
  puts '  Assessor override on Data Modelling (AI L2 -> human L4)'
end

vacancy = Vacancy.find_or_create_by!(role_title: 'Senior Backend Engineer — Payments') do |v|
  v.created_by              = 1
  v.culture_dimensions      = 'Writes things down. Disagrees early rather than late. Owns the pager.'
  v.competency_expectations = 'Owns a service end to end, including its failure modes.'
end

{
  'Distributed Systems' => 3, 'Data Modelling' => 3, 'API Design' => 4,
  'Testing Strategy' => 3, 'Incident Response' => 4
}.each do |label, level|
  VacancySkill.find_or_create_by!(vacancy: vacancy, skill_label: label) do |vs|
    vs.skill_id       = SKILLS.find { |s| s[:skill_label] == label }&.dig(:skill_id)
    vs.expected_level = level
  end
end
puts "  Vacancy ##{vacancy.id} with #{vacancy.vacancy_skills.count} required skills"

puts ''
puts '== Demo ready =='
puts "  Portfolio:  /assessments/#{assessment.id}/sessions/#{session.id}/portfolio"
puts "  Fit/gap:    /assessments/#{assessment.id}/sessions/#{session.id}/fitgap/#{vacancy.id}"
puts ''
puts '  Incident Response is deliberately never probed. Before this change it'
puts '  showed as L1 and as a hard gap. It should now read "Not assessed".'
puts "  Data Modelling carries an assessor override (AI L2 -> human L4)."
