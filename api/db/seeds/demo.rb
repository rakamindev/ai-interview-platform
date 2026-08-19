# frozen_string_literal: true

# Demo fixtures — development and test only. Loaded from db/seeds.rb.
#
# Every name and quote here is INVENTED. Committing real candidate speech would
# breach UU PDP and the brief's disqualifier list.
#
# Idempotent at the portfolio level: once any portfolio exists, the demo asset
# set is treated as present and skipped (a plain re-run of `db:seed`). The guard
# lives in db/seeds.rb — a top-level return here would be unsafe in a `load`
# context. Use `rails db:seed:replant` to reset the whole database.

def demo_org!(name:, scheme:, identifier:)
  Organization.find_by(scheme: scheme) ||
    Organization.create!(
      name: name,
      scheme: scheme,
      identifier: identifier,
      host: "#{identifier}.localhost",
      alias_hosts: ["localhost"],
      config: {}
    )
end

def demo_user!(email:)
  User.find_by(email: email) ||
    User.create!(email: email, role: "admin", password: "password")
end

def demo_assessment!(tenant_id:, created_by:, name:, language:, time_limit_min:)
  Assessment.create!(
    tenant_id: tenant_id,
    created_by: created_by,
    name: name,
    language: language,
    time_limit_min: time_limit_min
  )
end

def demo_assessment_skill!(assessment, skill_id:)
  tax = SkillTaxonomy.find_by!(skill_id: skill_id)
  assessment.assessment_skills.create!(
    skill_id: tax.skill_id,
    skill_label: tax.skill_label,
    scope_include: tax.scope_include,
    scope_exclude: tax.scope_exclude,
    l1_anchor: tax.l1_anchor,
    l2_anchor: tax.l2_anchor,
    l3_anchor: tax.l3_anchor,
    l4_anchor: tax.l4_anchor,
    l5_anchor: tax.l5_anchor,
    expected_level: 3,
    display_order: assessment.assessment_skills.count
  )
end

def demo_session!(assessment:, candidate_id:, status: "ended", end_reason: "all_covered", candidate_name: nil)
  Session.create!(
    tenant_id: assessment.tenant_id,
    assessment_id: assessment.id,
    status: status,
    end_reason: end_reason,
    candidate_name: candidate_name,
    candidate_id: candidate_id
  )
end

def demo_transcript!(session, turns)
  turns.each_with_index do |(speaker, text), i|
    session.transcript_turns.create!(turn_number: i + 1, speaker: speaker, text: text)
  end
end

def demo_coverage!(session, label:, state:, probe_count:, skill_id: nil, discovered: false)
  session.coverage_maps.create!(
    skill_id: skill_id,
    skill_label: label,
    state: state,
    probe_count: probe_count,
    is_discovered: discovered
  )
end

def demo_portfolio!(session, status: "complete")
  Portfolio.create!(
    session_id: session.id,
    candidate_id: session.candidate_id,
    generation_status: status,
    tenant_id: session.tenant_id
  )
end

def demo_portfolio_skill!(portfolio, label:, level:, summary:, skill_id: nil, confidence: "high", evidence: [])
  portfolio.portfolio_skills.create!(
    skill_id: skill_id,
    skill_label: label,
    is_discovered: skill_id.nil?,
    ai_level: level,
    ai_confidence: confidence,
    evidence: Array(evidence),
    competency_summary: summary,
    tenant_id: portfolio.tenant_id
  )
end

# ── Organizations ─────────────────────────────────────────────────────────────
test_corp  = demo_org!(name: "Test Corp",  scheme: "test-corp",  identifier: "test-corp")
rival_corp = demo_org!(name: "Rival Corp", scheme: "rival-corp", identifier: "rival-corp")

# ── Dev user (docs/07 §6) ──────────────────────────────────────────────────────
dev_user = demo_user!(email: "dev@test-corp.local")

# ── Assessments ────────────────────────────────────────────────────────────────
frontend_en = demo_assessment!(
  tenant_id: test_corp.id, created_by: dev_user.id,
  name: "Frontend Engineer", language: "en", time_limit_min: 45
)
%w[SK-ENG-001 SK-ENG-002 SK-ENG-005 SK-SOFT-001 SK-SOFT-002].each do |sid|
  demo_assessment_skill!(frontend_en, skill_id: sid)
end

software_id = demo_assessment!(
  tenant_id: test_corp.id, created_by: dev_user.id,
  name: "Insinyur Perangkat Lunak", language: "id", time_limit_min: 30
)
%w[SK-ENG-002 SK-ENG-004 SK-SOFT-002].each do |sid|
  demo_assessment_skill!(software_id, skill_id: sid)
end

# ── Vacancy (partial overlap -> match, gap, exceed, not_assessed in one report) ─
vacancy = Vacancy.create!(
  tenant_id: test_corp.id, created_by: dev_user.id,
  role_title: "Senior Frontend Engineer",
  culture_dimensions: "Calm under ambiguity; writes things down; reviews generously.",
  competency_expectations: "Can lead frontend architecture decisions and mentor juniors."
)
{ vacancy_skills: [
  ["SK-ENG-001", "React / Frontend Development Core", 4],
  ["SK-ENG-002", "Node.js / Backend Development", 2],
  ["SK-ENG-005", "RESTful API Design", 3],
  ["SK-SOFT-001", "Communication", 3],
  ["SK-PM-002", "Agile & Scrum Practices", 3]
] }.fetch(:vacancy_skills).each do |sid, label, expected|
  vacancy.vacancy_skills.create!(skill_id: sid, skill_label: label, expected_level: expected)
end

# ── Primary portfolio (complete, mixed confidence, + discovered strength) ──────
session_a = demo_session!(assessment: frontend_en, candidate_name: "Rina Kartika", candidate_id: 1001)
demo_coverage!(session_a, skill_id: "SK-ENG-001", label: "React / Frontend Development Core", state: "covered",
                          probe_count: 4)
demo_coverage!(session_a, skill_id: "SK-ENG-002", label: "Node.js / Backend Development", state: "covered",
                          probe_count: 3)
demo_coverage!(session_a, skill_id: "SK-ENG-005", label: "RESTful API Design", state: "partial", probe_count: 2)
demo_coverage!(session_a, skill_id: "SK-SOFT-001", label: "Communication", state: "covered", probe_count: 3)
demo_coverage!(session_a, skill_id: "SK-SOFT-002", label: "Problem Solving & Analytical Thinking", state: "covered",
                          probe_count: 3)
demo_coverage!(session_a, label: "Micro-frontend Architecture", state: "covered", probe_count: 1, discovered: true)
demo_transcript!(session_a, [
                   ["ai", "Tell me about a time you chose a state-management approach on your own."],
                   ["candidate",
                    "I moved the team off a hand-rolled state layer once profiling showed the re-render cost."],
                   ["ai", "What made that a defensible call rather than a preference?"],
                   ["candidate",
                    "The bottleneck was inside getServerSnapshot. We cut render time by focusing the subscription."],
                   ["ai", "How do you keep a checkout flow correct under concurrency?"],
                   ["candidate", "I memoise the derived cart totals and keep the rest on plain hooks."],
                   ["ai", "Describe an API you built that had to handle failure well."],
                   ["candidate", "I wrote CRUD endpoints and a background job that retried with backoff."],
                   ["ai", "Walk me through splitting a feature across two deployables."],
                   ["candidate",
                    "I split two applications into deployable modules last year, shared contracts to keep them decoupled."]
                 ])

portfolio_a = demo_portfolio!(session_a)
demo_portfolio_skill!(portfolio_a,
                      skill_id: "SK-ENG-001", label: "React / Frontend Development Core", level: 3, confidence: "high",
                      evidence: [
                        "I moved the team off a hand-rolled state layer once profiling showed the re-render cost.",
                        "The bottleneck was inside getServerSnapshot. We cut render time by focusing the subscription.",
                        "I memoise the derived cart totals and keep the rest on plain hooks."
                      ],
                      summary: "Builds complex features end to end and owns component performance for their area.")
demo_portfolio_skill!(portfolio_a,
                      skill_id: "SK-ENG-002", label: "Node.js / Backend Development", level: 3, confidence: "medium",
                      evidence: [
                        "I wrote CRUD endpoints and a background job that retried with backoff."
                      ],
                      summary: "Comfortable with routine API work and background jobs; lighter on distributed patterns.")
demo_portfolio_skill!(portfolio_a,
                      skill_id: "SK-ENG-005", label: "RESTful API Design", level: 2, confidence: "low",
                      evidence: [
                        "I have written CRUD endpoints and a couple of background jobs."
                      ],
                      summary: "Early-stage; mostly confirmed by a single answer.")
demo_portfolio_skill!(portfolio_a,
                      skill_id: "SK-SOFT-001", label: "Communication", level: 3, confidence: "high",
                      evidence: [
                        "Writes things down before debating them; the team adopted her meeting notes."
                      ],
                      summary: "Clear written and verbal communication, especially under ambiguity.")
demo_portfolio_skill!(portfolio_a,
                      skill_id: "SK-SOFT-002", label: "Problem Solving & Analytical Thinking", level: 4, confidence: "high",
                      evidence: [
                        "She profiled before rearchitecting and let the data decide the shape of the fix."
                      ],
                      summary: "Hypothesis-driven; does not rearchitect on preference.")
demo_portfolio_skill!(portfolio_a,
                      label: "Micro-frontend Architecture", level: 2, confidence: "low",
                      evidence: [
                        "I split two applications into deployable modules last year, shared contracts to keep them decoupled."
                      ],
                      summary: "Early familiarity with module composition and shared contracts.")

# ── All-low-confidence portfolio ───────────────────────────────────────────────
session_b = demo_session!(assessment: frontend_en, candidate_name: "Budi Santoso", candidate_id: 1002)
demo_coverage!(session_b, skill_id: "SK-ENG-001", label: "React / Frontend Development Core", state: "initiated",
                          probe_count: 1)
demo_coverage!(session_b, skill_id: "SK-SOFT-001", label: "Communication", state: "initiated", probe_count: 1)
portfolio_b = demo_portfolio!(session_b)
demo_portfolio_skill!(portfolio_b, skill_id: "SK-ENG-001", label: "React / Frontend Development Core", level: 2, confidence: "low",
                                   evidence: ["Connection dropped early; only one answer recorded."],
                                   summary: "Single answer only — insufficient coverage to rate confidently.")
demo_portfolio_skill!(portfolio_b, skill_id: "SK-SOFT-001", label: "Communication", level: 3, confidence: "low",
                                   evidence: ["Replied clearly once about a past sprint."],
                                   summary: "One data point; not enough for a confident level.")

# ── Override portfolio (provenance fixture, docs/10 uses this exact note) ──────
session_c = demo_session!(assessment: frontend_en, candidate_name: "Dewi Lestari", candidate_id: 1003)
demo_coverage!(session_c, skill_id: "SK-ENG-001", label: "React / Frontend Development Core", state: "covered",
                          probe_count: 3)
portfolio_c = demo_portfolio!(session_c)
skill_c_override = demo_portfolio_skill!(portfolio_c, skill_id: "SK-ENG-001", label: "React / Frontend Development Core", level: 2, confidence: "high",
                                                      evidence: ["The profiling detail showed how she isolates re-render costs."],
                                                      summary: "Solid foundations, under-read by the model.")
skill_c_override.create_assessor_override!(
  ai_level: 2, override_level: 4, assessor_notes: "Underrated — the profiling detail is L4 behaviour.",
  overridden_by: dev_user.id, overridden_at: Time.current,
  tenant_id: portfolio_c.tenant_id
)
demo_portfolio_skill!(portfolio_c, skill_id: "SK-SOFT-001", label: "Communication", level: 3, confidence: "high",
                                   evidence: ["Writes things down before debating them."],
                                   summary: "Clear communicator.")

# ── Failed portfolio ───────────────────────────────────────────────────────────
session_d = demo_session!(assessment: frontend_en, candidate_name: "Failed Candidate", end_reason: "error",
                          status: "failed", candidate_id: 1004)
demo_portfolio!(session_d, status: "failed")

# ── Generating portfolio ───────────────────────────────────────────────────────
session_e = demo_session!(assessment: frontend_en, candidate_name: "Generating Candidate", candidate_id: 1005)
demo_portfolio!(session_e, status: "generating")

# ── Zero-skill portfolio (empty state) ─────────────────────────────────────────
session_f = demo_session!(assessment: frontend_en, candidate_name: "Empty Candidate", end_reason: "time_ceiling",
                          candidate_id: 1006)
demo_portfolio!(session_f)

# ── Long-text portfolio (2000-char quote, 200-char label) ──────────────────────
long_label = "TypeScript & Type Systems — a deliberately over-long skill label that is exactly two hundred characters long so that truncation and tooltip behaviour have something real to chew on, and the table does not silently overflow"
session_g = demo_session!(assessment: frontend_en, candidate_name: "Long Text Candidate", candidate_id: 1007)
portfolio_g = demo_portfolio!(session_g)
demo_portfolio_skill!(portfolio_g, label: long_label, level: 3, confidence: "high",
                                   evidence: ["#{'The candidate explained how a re-run cost model works in practice, and then ' * 28}the answer continues to fill two thousand characters so the quote clamp and expand control are exercised in the real UI."],
                                   summary: "Long-form answer; layout must clamp without breaking.")

puts "  Demo fixtures: #{Portfolio.count} portfolios, #{Vacancy.count} vacancy, 2 organizations, assessments en+id"

# ── Rival org portfolio (cross-tenant hand verification, docs/07 §5) ──────────
rival_assessment = demo_assessment!(
  tenant_id: rival_corp.id, created_by: dev_user.id,
  name: "Backend Engineer", language: "en", time_limit_min: 30
)
rival_session = demo_session!(assessment: rival_assessment, candidate_name: "Rival Candidate", candidate_id: 2001)
rival_portfolio = demo_portfolio!(rival_session)
demo_portfolio_skill!(rival_portfolio, skill_id: "SK-ENG-002", label: "Node.js / Backend Development", level: 3, confidence: "high",
                                       evidence: ["Built a REST API with retry logic and backoff."],
                                       summary: "Solid backend fundamentals.")

# ── Fit/gap report for the primary portfolio (real engine path, then narratives) ─
begin
  report = FitGap::Engine.new(
    portfolio: portfolio_a,
    vacancy: vacancy,
    gemini_client: Gemini::StubClient.new(mode: :valid)
  ).call
  report.update!(
    culture_narrative: "Alias culture fit is strong: evidence shows calm, written-down, peer-facing communication under ambiguity — aligned with the stated expectations.",
    overall_narrative: "Rina is a strong senior candidate: exceeds on backend basics and problem-solving, at bar on communication, with one probed-once API-design gap and one clear strength (micro-frontends) outside the role."
  )
  puts "  Fit/gap report generated for portfolio #{portfolio_a.id} vs vacancy #{vacancy.id}"
rescue StandardError => e
  puts "  NOTE: fit/gap report skipped (#{e.class}: #{e.message})"
end
