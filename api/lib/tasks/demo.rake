# frozen_string_literal: true

# Local demo data for the Candidate Results Review story (Step 5).
#
#   bundle exec rake demo:seed
#
# Idempotent. Creates / updates records inside the test-corp tenant so the web
# app (running against http://localhost:3001) has rich, stable data to show:
#   - a COMPLETED portfolio with evidence, a low-confidence note, and an
#     assessor override (Session "Ahmad Rizky")
#   - a fit/gap report for that portfolio against a vacancy
#   - a FAILED portfolio to exercise the retry state (Session "Race Test")
#   - a session still GENERATING a portfolio
#   - an ACTIVE session for the Live Monitor screen
namespace :demo do
  desc "Seed demo data for the Candidate Results Review screens"
  task seed: :environment do
    org = ActiveRecord::Base.connection.select_one(
      "SELECT id, scheme FROM public.organizations WHERE scheme = 'test-corp' LIMIT 1"
    )

    abort "No test-corp organization found. Run `rails db:seed` first." unless org

    org_record = Organization.find_by(id: org["id"])
    raise "Organization##{org['id']} not found" unless org_record

    Current.using(organization: org_record, tenant_id: org_record.id) do
      assessment = Assessment.find_by!(id: 1)

      vacancy = Vacancy.find_or_initialize_by(
        role_title: "Senior Frontend Engineer",
        tenant_id:  org_record.id
      )
      vacancy.created_by = 1
      vacancy.culture_dimensions =
        "Direct and honest feedback; bias for action; ownership over outcomes; " \
        "async-first written communication."
      vacancy.competency_expectations =
        "Owns frontend architecture decisions, mentors juniors, and pairs a " \
        "deep sense of product outcomes with technical execution."
      vacancy.save!
      vacancy_skill_map = {
        "React / Frontend Development Core" => 3,
        "System Design & Architecture"      => 3,
        "Communication"                     => 2
      }
      vacancy.vacancy_skills.destroy_all
      vacancy_skill_map.each do |label, level|
        vacancy.vacancy_skills.create!(
          skill_id: SkillTaxonomy.find_by(skill_label: label)&.id,
          skill_label: label,
          expected_level: level
        )
      end
      puts "  vacancy: #{vacancy.role_title} (id=#{vacancy.id})"

      # ── COMPLETED portfolio: session 1 (Ahmad Rizky) ─────────────────────────
      completed = Assessment.unscoped.find(1).sessions.find_by(candidate_name: "Ahmad Rizky") ||
        Session.where(tenant_id: org_record.id).order(:id).first
      portfolio = Portfolio.find_or_initialize_by(session_id: completed.id, tenant_id: org_record.id)
      portfolio.generation_status = "complete"
      portfolio.generation_error = nil
      portfolio.generated_at = Time.current - 5.minutes
      portfolio.save!

      seed_skills = [
        {
          skill_label: "React / Frontend Development Core",
          ai_level: 3, ai_confidence: "high",
          evidence: [
            "I built the onboarding checklist feature — it had eight async states and I modelled them as a single reducer instead of scattered useState calls.",
            "We cut the main bundle by 40% after I introduced route-level code splitting and memoized the heavy table components."
          ],
          competency_summary: "Designs complex component trees with a clear state strategy. Optimizes rendering and owns the test strategy for the frontend.",
          discovered: false
        },
        {
          skill_label: "System Design & Architecture",
          ai_level: 2, ai_confidence: "medium",
          evidence: [
            "I sketched a pub/sub bus between the recorder and the analyser so the interview pipeline could scale past one node."
          ],
          competency_summary: "Comfortable with single-service designs and obvious bottlenecks; trade-off analysis at multi-service scale is still developing.",
          discovered: false
        },
        {
          skill_label: "Communication",
          ai_level: 4, ai_confidence: "high",
          evidence: [
            "When the migration slipped, I wrote a one-page decision doc with the trade-offs instead of a wall of Slack messages.",
            "I run the frontend chapter's weekly review and people actually bring the right artefacts."
          ],
          competency_summary: "Proactively aligns stakeholders, adapts the message to the audience, and facilitates cross-team meetings effectively.",
          discovered: false
        },
        {
          skill_label: "Testing & Quality Assurance",
          ai_level: 2, ai_confidence: "low",
          evidence: ["Mentioned writing a few integration tests but did not describe a test strategy."],
          competency_summary: "Writes unit and integration tests for own code; the candidate did not show evidence of owning a broader test strategy.",
          discovered: true
        }
      ]

      portfolio.portfolio_skills.destroy_all
      AssessorOverride.where(portfolio_skill_id: portfolio.portfolio_skill_ids).destroy_all
      seed_skills.each do |s|
        ps = portfolio.portfolio_skills.create!(
          skill_id: SkillTaxonomy.find_by(skill_label: s[:skill_label])&.id,
          skill_label: s[:skill_label],
          is_discovered: s[:discovered],
          ai_level: s[:ai_level],
          ai_confidence: s[:ai_confidence],
          evidence: s[:evidence],
          competency_summary: s[:competency_summary]
        )
        next if ps.skill_label != "System Design & Architecture"

        # Human override: AI said L2, assessor bumped to L3.
        ps.create_assessor_override!(
          ai_level: ps.ai_level,
          override_level: 3,
          assessor_notes: "The pub/sub sketch plus the trade-off reasoning in the decision doc justify L3 despite thin direct evidence.",
          overridden_by: 1,
          overridden_at: Time.current
        )
      end
      puts "  portfolio: complete (id=#{portfolio.id}, #{portfolio.portfolio_skills.size} skills)"

      # ── FIT/GAP report for the completed portfolio ────────────────────────────
      report = FitGapReport.find_or_initialize_by(
        portfolio_id: portfolio.id,
        vacancy_id:   vacancy.id,
        tenant_id:    org_record.id
      )
      comparisons = [
        { "skill_label" => "React / Frontend Development Core", "required_level" => 3, "candidate_level" => 3, "result" => "match", "delta" => 0, "is_override" => false },
        { "skill_label" => "System Design & Architecture", "required_level" => 3, "candidate_level" => 3, "result" => "match", "delta" => 0, "is_override" => true },
        { "skill_label" => "Communication", "required_level" => 2, "candidate_level" => 4, "result" => "exceed", "delta" => 2, "is_override" => false },
        { "skill_label" => "Testing & Quality Assurance", "required_level" => 2, "candidate_level" => nil, "result" => "not_assessed", "delta" => nil, "is_override" => false }
      ]
      report.skill_comparisons = comparisons
      report.culture_narrative =
        "Ahmad values direct feedback, ownership, and async-first communication — all three show up in how he describes the " \
        "migration decision doc and the frontend chapter reviews. He is a strong culture match for a team that writes things down " \
        "and expects people to drive outcomes without being told."
      report.overall_narrative =
        "Ahmad is a strong hire overall. Frontend depth is confirmed at L3, and his communication is above the bar. " \
        "System Design reached the required level only via the assessor override (AI rated L2); a short technical screen on " \
        "multi-service trade-offs is recommended. Testing strategy is worth probing in the first months."
      report.save!
      puts "  fit/gap report: id=#{report.id}"

      # ── FAILED portfolio (session "Race Test") to demo the retry state ────────
      failed_session = Session.find_by(candidate_name: "Race Test")
      if failed_session
        failed_portfolio = Portfolio.find_or_initialize_by(session_id: failed_session.id, tenant_id: org_record.id)
        failed_portfolio.generation_status = "failed"
        failed_portfolio.generation_error = "Gemini returned a non-JSON response after 3 attempts."
        failed_portfolio.generated_at = nil
        failed_portfolio.portfolio_skills.destroy_all if failed_portfolio.portfolio_skills.any?
        failed_portfolio.save!
        puts "  portfolio: failed (id=#{failed_portfolio.id})"
      end

      # ── GENERATING state session (no portfolio yet) ───────────────────────────
      generating_session = Session.find_or_initialize_by(candidate_name: "Dewi Lestari", tenant_id: org_record.id)
      if generating_session.new_record?
        generating_session.assessment_id = assessment.id
        generating_session.candidate_id = nil
        generating_session.invite_token = SecureRandom.urlsafe_base64(16)
        generating_session.status = "ended"
        generating_session.end_reason = "all_covered"
        generating_session.started_at = Time.current - 3.minutes
        generating_session.ended_at = Time.current - 1.minute
        generating_session.save!
      end
      gen_portfolio = Portfolio.find_or_initialize_by(session_id: generating_session.id, tenant_id: org_record.id)
      gen_portfolio.generation_status = "generating"
      gen_portfolio.generation_error = nil
      gen_portfolio.generated_at = nil
      gen_portfolio.portfolio_skills.destroy_all if gen_portfolio.portfolio_skills.any?
      gen_portfolio.save!
      puts "  portfolio: generating (session=#{generating_session.id})"

      # ── ACTIVE session for the Live Monitor screen ────────────────────────────
      active_session = Session.find_or_initialize_by(candidate_name: "Budi Santoso", tenant_id: org_record.id)
      if active_session.new_record?
        active_session.assessment_id = assessment.id
        active_session.candidate_id = nil
        active_session.invite_token = SecureRandom.urlsafe_base64(16)
        active_session.status = "active"
        active_session.started_at = Time.current - 4.minutes
        active_session.save!
      end
      puts "  session: active (id=#{active_session.id}, Budi Santoso)"
    end

    puts "== demo:seed complete =="
  end
end