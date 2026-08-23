# frozen_string_literal: true

# Deterministic end-to-end demo data.
#
#   docker compose exec api bundle exec rails demo:seed
#   docker compose exec api bundle exec rails demo:reset   # drop and re-seed
#
# db/seeds.rb only creates the organization and the skill taxonomy, which
# leaves no way to reach the portfolio or fit/gap screens without running a
# live AI interview. This task builds one complete assessed candidate so the
# whole downstream workflow is reachable and reproducible.
#
# The scenario is chosen to land on every branch of the fit/gap comparison —
# match, exceed, gap, and not_assessed — plus an assessor override, a
# discovered skill, a medium-confidence rating, and a deliberately long skill
# label. All candidate text is synthetic; no real personal data is used.

namespace :demo do
  SCHEME = 'test-corp'

  desc 'Seed one fully assessed candidate, a vacancy, and an assessor override'
  task seed: :environment do
    org = ActiveRecord::Base.connection.select_one(
      ActiveRecord::Base.sanitize_sql_array(
        ['SELECT id FROM public.organizations WHERE scheme = ? LIMIT 1', SCHEME]
      )
    )
    abort "No organization with scheme '#{SCHEME}'. Run `rails db:seed` first." if org.nil?

    Current.tenant_id = org['id'].to_i
    puts "== Demo seed (tenant_id=#{Current.tenant_id}) =="

    assessor = User.find_or_initialize_by(email: 'assessor@test-corp.example')
    if assessor.new_record?
      assessor.password = SecureRandom.hex(16)
      assessor.role     = 'admin'
      assessor.save!
    end
    puts "  assessor user id=#{assessor.id}"

    # ── Assessment ───────────────────────────────────────────────────────────
    assessment = Assessment.find_or_initialize_by(name: 'Senior Frontend Engineer — Skills Interview')
    assessment.assign_attributes(
      created_by:     assessor.id,
      time_limit_min: 45,
      language:       'en',
      system_prompt:  'Probe each configured skill against its behavioural anchors.'
    )
    assessment.save!
    puts "  assessment id=#{assessment.id}"

    # Anchors are copied from the seeded taxonomy so the demo mirrors reality.
    def anchors_for(skill_id)
      t = SkillTaxonomy.find_by(skill_id: skill_id)
      return {} if t.nil?

      {
        scope_include: t.scope_include,
        scope_exclude: t.scope_exclude,
        l1_anchor: t.l1_anchor, l2_anchor: t.l2_anchor, l3_anchor: t.l3_anchor,
        l4_anchor: t.l4_anchor, l5_anchor: t.l5_anchor
      }
    end

    configured = [
      ['SK-ENG-001', 'React / Frontend Development Core', 4],
      ['SK-ENG-009', 'TypeScript & Type Systems',         3],
      ['SK-ENG-003', 'System Design & Architecture',      4],
      ['SK-ENG-006', 'Testing & Quality Assurance',       3],
      ['SK-ENG-010', 'Security Engineering',              3]
    ]

    assessment.assessment_skills.destroy_all
    configured.each_with_index do |(sid, label, expected), i|
      assessment.assessment_skills.create!(
        { skill_id: sid, skill_label: label, expected_level: expected, display_order: i }
          .merge(anchors_for(sid))
      )
    end
    puts "  assessment_skills: #{assessment.assessment_skills.count}"

    # ── Session + transcript + coverage ──────────────────────────────────────
    session = Session.find_or_initialize_by(assessment_id: assessment.id, candidate_name: 'Sinta Wijaya')
    session.assign_attributes(
      candidate_id:     2,
      status:           'ended',
      end_reason:       'time_ceiling',
      started_at:       2.days.ago,
      ended_at:         2.days.ago + 44.minutes,
      duration_seconds: 44 * 60
    )
    session.save!
    puts "  session id=#{session.id} invite_token=#{session.invite_token[0, 12]}…"

    session.transcript_turns.destroy_all
    [
      [:ai,        'Walk me through how you structure state in a large React app.'],
      [:candidate, 'I separate server state from client state. React Query owns anything that comes from the API, and I keep local UI state in components. I moved us off a single Redux store because most of it was just cached responses.'],
      [:ai,        'How do you decide when a component needs memoisation?'],
      [:candidate, 'I profile first. I only reach for memo when the flame chart shows a real cost — otherwise it adds noise and stale-closure bugs.'],
      [:ai,        'Tell me about a system you designed end to end.'],
      [:candidate, 'I built a notifications feature. It was one service with a queue. I followed the pattern our staff engineer set up rather than designing the boundaries myself.'],
      [:ai,        'How do you approach testing?'],
      [:candidate, 'I write unit tests for logic and integration tests for the main flows. I own the test strategy for my area and I fix flaky tests rather than retrying them.'],
      [:ai,        'What is your experience with TypeScript?'],
      [:candidate, 'I led our migration from JS. I wrote the shared generic types for our API client so responses are inferred end to end, and I set the tsconfig strictness policy the team follows.']
    ].each_with_index do |(speaker, text), i|
      session.transcript_turns.create!(turn_number: i + 1, speaker: speaker.to_s, text: text)
    end
    puts "  transcript_turns: #{session.transcript_turns.count}"

    session.coverage_maps.destroy_all
    [
      ['SK-ENG-001', 'React / Frontend Development Core', 'covered',   4],
      ['SK-ENG-009', 'TypeScript & Type Systems',         'covered',   3],
      ['SK-ENG-003', 'System Design & Architecture',      'partial',   2],
      ['SK-ENG-006', 'Testing & Quality Assurance',       'covered',   3],
      # Touched once, never developed — evidence insufficient to place a level.
      ['SK-ENG-005', 'RESTful API Design',                'initiated', 1],
      # Security was never reached before the time ceiling — this is the case
      # the product currently has no way to represent downstream.
      ['SK-ENG-010', 'Security Engineering',              'not_yet',   0]
    ].each do |sid, label, state, probes|
      session.coverage_maps.create!(skill_id: sid, skill_label: label, state: state, probe_count: probes)
    end
    session.coverage_maps.create!(
      skill_id: nil, skill_label: 'Developer Experience & Tooling',
      is_discovered: true, state: 'partial', probe_count: 2
    )
    puts "  coverage_maps: #{session.coverage_maps.count}"

    # ── Portfolio ────────────────────────────────────────────────────────────
    portfolio = session.portfolio || session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'pending')
    portfolio.update!(generation_status: 'complete', generated_at: 1.day.ago, generation_error: nil)
    portfolio.portfolio_skills.destroy_all

    skills = {}
    [
      ['SK-ENG-001', 'React / Frontend Development Core', 4, 'high',
       ['I separate server state from client state.', 'I profile first.'],
       'Consistently designs and justifies frontend architecture. Profiles before optimising rather than reaching for memoisation reflexively.'],
      ['SK-ENG-009', 'TypeScript & Type Systems', 4, 'high',
       ['I led our migration from JS.', 'I set the tsconfig strictness policy the team follows.'],
       'Defines typing standards for the team and builds reusable generic abstractions. Operates above the level the role requires.'],
      ['SK-ENG-003', 'System Design & Architecture', 2, 'medium',
       ['I followed the pattern our staff engineer set up rather than designing the boundaries myself.'],
       'Builds within an existing architecture competently but has not yet owned service boundaries or trade-off decisions independently.'],
      ['SK-ENG-006', 'Testing & Quality Assurance', 3, 'high',
       ['I own the test strategy for my area and I fix flaky tests rather than retrying them.'],
       'Owns test strategy for a feature area and treats flakiness as a defect rather than noise.']
    ].each do |sid, label, level, conf, evidence, summary|
      skills[sid] = portfolio.portfolio_skills.create!(
        skill_id: sid, skill_label: label, is_discovered: false,
        ai_level: level, ai_confidence: conf, evidence: evidence, competency_summary: summary
      )
    end

    # Present in the portfolio but carrying no level: the interview touched
    # this skill and the evidence did not support placing it. Distinct from
    # Security Engineering, which was never reached at all — the fit/gap
    # report must not report the two identically.
    skills['SK-ENG-005'] = portfolio.portfolio_skills.create!(
      skill_id: 'SK-ENG-005', skill_label: 'RESTful API Design', is_discovered: false,
      ai_level: nil, ai_confidence: 'low',
      evidence: [],
      competency_summary: 'Mentioned in passing while discussing the notifications service. ' \
                          'Nothing in the transcript places this against the anchors.'
    )

    portfolio.portfolio_skills.create!(
      skill_id: nil, skill_label: 'Developer Experience & Tooling', is_discovered: true,
      ai_level: 3, ai_confidence: 'medium',
      evidence: ['I moved us off a single Redux store because most of it was just cached responses.'],
      competency_summary: 'Surfaced unprompted: removes accidental complexity from the team toolchain.'
    )
    puts "  portfolio_skills: #{portfolio.portfolio_skills.count} (Security Engineering absent — never assessed)"

    # An assessor disagreed with the model and moved Testing down.
    testing = skills['SK-ENG-006']
    AssessorOverride.find_or_initialize_by(portfolio_skill_id: testing.id).tap do |o|
      o.assign_attributes(
        ai_level:       testing.ai_level,
        override_level: 2,
        assessor_notes: 'Candidate described the practice accurately but could not give a concrete example of a test they designed. Moving to L2 pending a work sample.',
        overridden_by:  assessor.id,
        overridden_at:  Time.current
      )
      o.save!
    end
    puts "  assessor_override: Testing & QA  AI L#{testing.ai_level} → assessor L2"

    # ── Vacancy ──────────────────────────────────────────────────────────────
    vacancy = Vacancy.find_or_initialize_by(role_title: 'Senior Frontend Engineer')
    vacancy.assign_attributes(
      created_by: assessor.id,
      culture_dimensions:      'Bias to action; writes before deciding; treats disagreement as information.',
      competency_expectations: 'Owns a domain end to end. Mentors mid-level engineers. Comfortable with ambiguity.'
    )
    vacancy.save!
    vacancy.vacancy_skills.destroy_all
    [
      ['SK-ENG-001', 'React / Frontend Development Core', 4],  # → match
      ['SK-ENG-009', 'TypeScript & Type Systems',         3],  # → exceed
      ['SK-ENG-003', 'System Design & Architecture',      4],  # → gap
      ['SK-ENG-006', 'Testing & Quality Assurance',       3],  # → override applied
      ['SK-ENG-005', 'RESTful API Design',                3],  # → not_assessed (insufficient_evidence)
      ['SK-ENG-010', 'Security Engineering',              3],  # → not_assessed (not_covered)
      # Long label on purpose: exercises truncation / wrapping in the table.
      ['SK-ENG-008', 'Cloud Infrastructure (AWS / GCP / Azure) including Terraform module design, multi-region failover and cost governance', 2] # → not_assessed
    ].each do |sid, label, expected|
      vacancy.vacancy_skills.create!(skill_id: sid, skill_label: label, expected_level: expected)
    end
    puts "  vacancy id=#{vacancy.id} skills=#{vacancy.vacancy_skills.count}"

    puts ''
    puts '== Done =='
    puts "  Portfolio : /assessments/#{assessment.id}/sessions/#{session.id}/portfolio"
    puts "  Fit/Gap   : /assessments/#{assessment.id}/sessions/#{session.id}/fitgap/#{vacancy.id}"
    puts "  portfolio_id=#{portfolio.id} vacancy_id=#{vacancy.id}"
  end

  desc 'Remove demo data and re-seed'
  task reset: :environment do
    org = ActiveRecord::Base.connection.select_one(
      ActiveRecord::Base.sanitize_sql_array(
        ['SELECT id FROM public.organizations WHERE scheme = ? LIMIT 1', SCHEME]
      )
    )
    abort "No organization with scheme '#{SCHEME}'." if org.nil?

    Current.tenant_id = org['id'].to_i
    Vacancy.where(role_title: 'Senior Frontend Engineer').destroy_all
    Assessment.where(name: 'Senior Frontend Engineer — Skills Interview').find_each do |a|
      a.sessions.destroy_all
      a.destroy
    end
    puts '== Demo data removed =='
    Rake::Task['demo:seed'].invoke
  end
end
