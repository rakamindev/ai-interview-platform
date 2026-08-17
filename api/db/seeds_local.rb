# frozen_string_literal: true
#
# Local exploration data — NOT part of `rails db:seed`.
# Usage: bundle exec rails runner db/seeds_local.rb
#
# Creates one assessment, one vacancy with expected levels, one completed
# session, and one portfolio whose skills deliberately include rows that the
# current generator would produce from missing or malformed model output.

def enum_labels(model, column)
  type = model.columns_hash[column].sql_type
  ActiveRecord::Base.connection.select_values("SELECT unnest(enum_range(NULL::#{type}))")
rescue StandardError
  []
end

def pick(labels, pattern, fallback)
  labels.find { |l| l.to_s.match?(pattern) } || labels.last || fallback
end

org = ActiveRecord::Base.connection.select_one(
  "SELECT id, scheme FROM public.organizations ORDER BY id LIMIT 1"
)
tenant_id = org["id"]
puts "Tenant: id=#{tenant_id} scheme=#{org['scheme']}"

admin = User.find_by(email: "assessor@rakamin.test") ||
        User.create!(email: "assessor@rakamin.test", password: "Password123!", role: "admin")
candidate = User.find_by(email: "candidate@example.test") ||
            User.create!(email: "candidate@example.test", password: "Password123!", role: "user")
puts "Users: admin=#{admin.id} candidate=#{candidate.id}"

puts "Session status enum   : #{enum_labels(Session, 'status').inspect}"
puts "Generation status enum: #{enum_labels(Portfolio, 'generation_status').inspect}"

assessment = Assessment.find_or_create_by!(tenant_id: tenant_id, name: "Fullstack Engineer - Pilot") do |a|
  a.created_by     = admin.id
  a.time_limit_min = 45
  a.system_prompt  = "Probe the candidate's engineering competencies against the configured skills."
  a.language       = "en" if Assessment.column_names.include?("language")
end
puts "Assessment: #{assessment.id}"

vacancy = Vacancy.find_or_create_by!(tenant_id: tenant_id, role_title: "Fullstack Engineer") do |v|
  v.created_by              = admin.id
  v.culture_dimensions      = [{ "name" => "Ownership", "description" => "Takes end-to-end responsibility" }]
  v.competency_expectations = { "summary" => "Mid-level fullstack engineer" }
end
puts "Vacancy: #{vacancy.id}"

# Five configured skills. SK-PM-005 is deliberately left out of the portfolio
# below, to reproduce the configured-but-omitted case (AC-11).
{ "SK-ENG-001" => 3, "SK-ENG-002" => 4, "SK-ENG-004" => 3,
  "SK-SOFT-002" => 4, "SK-PM-005" => 3 }.each do |skill_id, level|
  taxonomy = SkillTaxonomy.find_by(skill_id: skill_id)
  next puts("  MISSING taxonomy #{skill_id}") unless taxonomy

  vs = VacancySkill.find_or_initialize_by(vacancy_id: vacancy.id, skill_id: skill_id)
  vs.skill_label    = taxonomy.skill_label
  vs.expected_level = level
  vs.save!
  puts "  VacancySkill #{skill_id} expected L#{level}"
end

session = Session.find_or_create_by!(tenant_id: tenant_id, assessment_id: assessment.id,
                                     candidate_id: candidate.id) do |s|
  s.invite_token      = SecureRandom.hex(16)
  s.candidate_name    = "Test Candidate"
  s.status            = pick(enum_labels(Session, "status"), /complete|ended|finish/, "completed")
  s.started_at        = 1.hour.ago
  s.ended_at          = 20.minutes.ago
  s.duration_seconds  = 2400
end
puts "Session: #{session.id} invite_token=#{session.invite_token}"

portfolio = Portfolio.find_or_create_by!(session_id: session.id) do |p|
  p.candidate_id       = candidate.id
  p.generation_status  = pick(enum_labels(Portfolio, "generation_status"), /complete/, "complete")
  p.generated_at       = Time.current
end
puts "Portfolio: #{portfolio.id}"

# Each row below is what the CURRENT generator would persist for a given model
# response. Nothing here is hypothetical: ai_level 1 with empty evidence is
# exactly `nil.to_i.clamp(1, 5)`.
skills = [
  { skill_id: "SK-ENG-001", level: 4, confidence: "high", discovered: false,
    evidence: ["Explained memoization trade-offs under load",
               "Walked through a code-splitting rollout and its regression"],
    summary: "Designs and builds complex features end-to-end." },

  # Never discussed in the interview. Model omitted the level. Stored as L1.
  { skill_id: "SK-ENG-002", level: 1, confidence: "high", discovered: false,
    evidence: [],
    summary: "Not covered during the interview." },

  # Model returned "L3" instead of 3. "L3".to_i => 0 => clamp => 1.
  { skill_id: "SK-ENG-004", level: 1, confidence: "medium", discovered: false,
    evidence: [],
    summary: "Model returned a non-numeric competency level." },

  { skill_id: "SK-SOFT-002", level: 4, confidence: "medium", discovered: false,
    evidence: ["Broke down an ambiguous incident into testable hypotheses"],
    summary: "Navigates ambiguous problems independently." },

  # Discovered skill outside the vacancy: FitGap::Engine drops it entirely.
  { skill_id: nil, label: "Kubernetes Operations", level: 3, confidence: "low",
    discovered: true,
    evidence: ["Mentioned running kubectl against staging"],
    summary: "Surfaced by the model, absent from the configured skill set." }
]

skills.each do |row|
  label = row[:label] || SkillTaxonomy.find_by(skill_id: row[:skill_id])&.skill_label
  next puts("  SKIPPED #{row.inspect}") unless label

  ps = PortfolioSkill.find_or_initialize_by(portfolio_id: portfolio.id, skill_label: label)
  ps.skill_id           = row[:skill_id]
  ps.is_discovered      = row[:discovered]
  ps.ai_level           = row[:level]
  ps.ai_confidence      = row[:confidence]
  ps.evidence           = row[:evidence]
  ps.competency_summary = row[:summary]
  ps.save!
  puts "  PortfolioSkill #{label} => L#{row[:level]} #{row[:confidence]} evidence=#{row[:evidence].size}"
end

puts ""
puts "Done. Portfolio ##{portfolio.id}, Vacancy ##{vacancy.id}"
puts "Fit/gap: GET /api/v1/portfolios/#{portfolio.id}/fitgap?vacancy_id=#{vacancy.id}"