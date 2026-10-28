# frozen_string_literal: true

# Seeds finished interviews so the results screens can be reviewed without a
# Gemini key. The real Portfolios::Generator and FitGap::Engine run; only the
# model reply is scripted, and it contains the mistakes real model output does
# (a level for a skill never discussed, a quote the candidate never said).
# All people and companies here are fictional.
namespace :demo do
  desc 'Seed fictional finished interviews covering every results state (development only)'
  task seed_results: :environment do
    abort 'demo:seed_results only runs in development.' unless Rails.env.development?

    scripted = Class.new do
      def initialize(payload) = @payload = payload
      def generate_content(*) = @payload
    end

    org = Organization.find_by!(scheme: 'test-corp')
    RequestStore.store[:organization] = org
    RequestStore.store[:tenant_id]    = org.id
    user = User.find_or_create_by!(email: 'assessor@test-corp.local') { |u| u.password = 'password123'; u.role = 'admin' }

    anchors = { l1_anchor: 'Needs close guidance', l2_anchor: 'Independent on routine work',
                l3_anchor: 'Handles ambiguity and trade-offs', l4_anchor: 'Sets team standards',
                l5_anchor: 'Shapes practice across the org' }
    assessment = Assessment.create!(
      name: 'Senior Frontend Engineer — Demo', time_limit_min: 45, created_by: user.id,
      assessment_skills_attributes: [
        anchors.merge(skill_id: 'sk-eng-001', skill_label: 'React / Frontend Development', expected_level: 3, display_order: 0),
        anchors.merge(skill_label: 'Communication', is_custom: true, expected_level: 3, display_order: 1),
        anchors.merge(skill_label: 'Testing Strategy', is_custom: true, expected_level: 2, display_order: 2),
        anchors.merge(skill_label: 'System Design', is_custom: true, expected_level: 2, display_order: 3)
      ]
    )

    vacancy = Vacancy.create!(
      role_title: 'Senior Frontend Engineer (Logistics Dashboard)', created_by: user.id,
      culture_dimensions: 'Ownership, direct feedback, async-first',
      vacancy_skills_attributes: [
        { skill_id: 'sk-eng-001', skill_label: 'React / Frontend Development', expected_level: 3 },
        { skill_label: 'Communication', expected_level: 3 },
        { skill_label: 'Testing Strategy', expected_level: 2 },
        { skill_label: 'System Design', expected_level: 2 },
        { skill_label: 'SQL & Data Modelling', expected_level: 2 }
      ]
    )

    new_session = lambda do |name, **attrs|
      assessment.sessions.create!({ tenant_id: org.id, candidate_name: name, status: 'ended', end_reason: 'time_ceiling',
                                    started_at: 46.minutes.ago, ended_at: 1.minute.ago, duration_seconds: 2700 }.merge(attrs))
    end

    # ── 1. Ended at the time limit: one skill never reached ─────────────────
    s = new_session.call('Rina Wulandari (fictional)')
    [
      ['sk-eng-001', 'React / Frontend Development', 'covered', 5],
      [nil, 'Communication', 'partial', 2],
      [nil, 'Testing Strategy', 'covered', 3],
      [nil, 'System Design', 'not_yet', 0]
    ].each { |id, label, state, probes| s.coverage_maps.create!(skill_id: id, skill_label: label, state:, probe_count: probes) }
    s.coverage_maps.create!(skill_label: 'Micro-frontend Architecture', is_discovered: true, state: 'partial', probe_count: 2)

    [
      ['ai', 'Hi Rina, thanks for joining. Tell me about the most technically challenging frontend project you worked on recently.'],
      ['candidate', 'At my last job we built a real-time dashboard for logistics tracking, with hundreds of updates per second. The hard part was keeping React state in sync without the whole page re-rendering.'],
      ['ai', 'Hundreds of updates a second is a lot. What was breaking before you fixed it?'],
      ['candidate', 'Every websocket event dispatched a Redux action, so the whole dashboard re-rendered. We profiled it and about eighty percent of renders were wasted. We moved the hot real-time data into useRef and only committed it to state on a timer.'],
      ['ai', 'How did you decide what stayed in Redux?'],
      ['candidate', 'Anything shared across routes or persisted stayed in Redux. Ephemeral UI state went local. Later we also split the app into micro-frontends because the team grew to twelve engineers and deploys were a bottleneck.'],
      ['ai', 'How did you test the ref-based approach?'],
      ['candidate', 'Unit tests on the pure reducers, and a Playwright test that replays a recorded websocket stream and checks the map markers.'],
      ['ai', 'How did you get the team to agree to move away from Redux for that data?'],
      ['candidate', 'I put together a one-pager with the profiling numbers and shared it in Slack before the meeting, so people came in with context.']
    ].each.with_index(1) { |(speaker, text), n| s.transcript_turns.create!(turn_number: n, speaker:, text:) }

    long_summary = 'Rina consistently reasons about rendering cost before reaching for a library, and backs claims with ' \
                   'profiling data rather than intuition. She separated shared from ephemeral state with a clear rule and ' \
                   'can explain why it held up at twelve engineers. ' * 3
    model_reply = {
      'configured_skills' => [
        { 'skill_id' => 'sk-eng-001', 'skill_label' => 'React / Frontend Development', 'level' => 'L3', 'confidence' => 'high',
          'evidence' => ['We moved the hot real-time data into useRef and only committed it to state on a timer',
                         'about eighty percent of renders were wasted',
                         'I rewrote our state layer in a weekend'], # never said
          'competency_summary' => long_summary.strip },
        { 'skill_label' => 'Communication', 'level' => 3, 'confidence' => 'high',
          'evidence' => ['I put together a one-pager with the profiling numbers and shared it in Slack before the meeting'],
          'competency_summary' => 'Prepares written context before decisions. Only one example was explored, so the ceiling is unclear.' },
        { 'skill_label' => 'Testing Strategy', 'level' => 2, 'confidence' => 'medium',
          'evidence' => ['I always aim for one hundred percent coverage'], # never said
          'competency_summary' => 'Uses unit tests and one end-to-end replay test.' },
        { 'skill_label' => 'System Design', 'level' => 1, 'confidence' => 'low', 'evidence' => [],
          'competency_summary' => 'Limited evidence of system design.' }
      ],
      'discovered_skills' => [
        { 'skill_label' => 'Micro-frontend Architecture', 'level' => 2, 'confidence' => 'low',
          'evidence' => ['we also split the app into micro-frontends because the team grew to twelve engineers'],
          'competency_summary' => 'Has worked in a micro-frontend setup; only briefly explored.' }
      ]
    }
    portfolio = Portfolios::Generator.new(session: s, gemini_client: scripted.new(model_reply)).call
    FitGap::Engine.new(portfolio:, vacancy:, gemini_client: scripted.new(
      'culture_narrative' => 'Rina backs proposals with data and prepares written context before meetings, which fits an async-first team.',
      'overall_narrative' => 'Meets the React and testing bar and is at the bar for communication. System Design and SQL were not assessed in this interview and need a follow-up before a decision.'
    )).call

    # ── 2. Model failed ─────────────────────────────────────────────────────
    failed = new_session.call('Budi Hartono (fictional)', end_reason: 'manual_candidate')
    failed.coverage_maps.create!(skill_label: 'Communication', state: 'covered', probe_count: 3)
    failed.create_portfolio!(generation_status: 'failed', generation_attempts: 4,
                             generation_error: 'The AI model took too long to respond.')

    # ── 3. Still generating ─────────────────────────────────────────────────
    running = new_session.call('Sari Putri (fictional)', end_reason: 'all_covered')
    running.create_portfolio!(generation_status: 'generating', generation_started_at: 20.seconds.ago, generation_attempts: 1)

    puts "Seeded assessment #{assessment.id}, vacancy #{vacancy.id}"
    puts "  complete:   /assessments/#{assessment.id}/sessions/#{s.id}/portfolio"
    puts "  fit/gap:    /assessments/#{assessment.id}/sessions/#{s.id}/fitgap/#{vacancy.id}"
    puts "  failed:     /assessments/#{assessment.id}/sessions/#{failed.id}/portfolio"
    puts "  generating: /assessments/#{assessment.id}/sessions/#{running.id}/portfolio"
    puts 'Log in as assessor@test-corp.local / password123'
  end
end
