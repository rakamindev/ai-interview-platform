# frozen_string_literal: true

# Script to populate mock/dummy data for UI testing under heavy load.
# Safe to re-run.
#
# Usage:
#   bundle exec rails runner db/seeds_dummy.rb

puts "== Generating Realistic Dummy Data for UI Testing =="

org = Organization.find_by(scheme: "test-corp") || Organization.first
unless org
  puts "ERROR: Organization not found. Please run 'bundle exec rails db:seed' first."
  exit 1
end

Current.organization = org
Current.tenant_id = org.id

user = User.first || User.create!(
  email: "admin@testcorp.com",
  password: "Password123!",
  role: "admin"
)
Current.user = user

skills = SkillTaxonomy.all.to_a
if skills.empty?
  puts "ERROR: SkillTaxonomy is empty. Please run 'bundle exec rails db:seed' first."
  exit 1
end

# ── 1. Create 25 Assessments ────────────────────────────────────────────────
assessment_templates = [
  { name: "Senior Frontend React Engineer", time: 45, lang: "en" },
  { name: "Fullstack Ruby & React Developer", time: 60, lang: "en" },
  { name: "Junior Backend Node.js Developer", time: 30, lang: "id" },
  { name: "Lead Cloud & DevOps Specialist", time: 60, lang: "en" },
  { name: "QA Automation & Reliability Engineer", time: 30, lang: "en" },
  { name: "Principal System Architect", time: 90, lang: "en" },
  { name: "Data Engineer - SQL & Analytics", time: 45, lang: "en" },
  { name: "Product Manager - Technical Platform", time: 45, lang: "id" },
  { name: "Associate Frontend Developer", time: 30, lang: "id" },
  { name: "Information Security Analyst", time: 45, lang: "en" },
  { name: "Engineering Manager - Growth", time: 60, lang: "en" },
  { name: "Site Reliability Engineer (SRE)", time: 45, lang: "en" },
  { name: "Mobile Developer - Cross Platform", time: 30, lang: "id" },
  { name: "AI/ML Solutions Architect", time: 60, lang: "en" },
  { name: "Scrum Master & Agile Coach", time: 30, lang: "id" },
  { name: "Database Administrator (PostgreSQL)", time: 45, lang: "en" },
  { name: "Junior Quality Assurance Tester", time: 10, lang: "id" },
  { name: "Senior Platform Infrastructure Engineer", time: 60, lang: "en" },
  { name: "Technical Technical Lead - Fintech", time: 90, lang: "en" },
  { name: "Backend API Specialist - Microservices", time: 45, lang: "en" },
  { name: "Software Development Intern 2026", time: 10, lang: "id" },
  { name: "Cybersecurity & Compliance Lead", time: 45, lang: "en" },
  { name: "UI/UX Technical Designer", time: 30, lang: "id" },
  { name: "Cloud Architect - AWS Specialist", time: 60, lang: "en" },
  { name: "Senior TypeScript Systems Engineer", time: 45, lang: "en" }
]

created_assessments = []

assessment_templates.each_with_index do |tmpl, idx|
  assessment = Assessment.unscoped.find_or_initialize_by(
    tenant_id: org.id,
    name: tmpl[:name]
  )

  assessment.time_limit_min = tmpl[:time]
  assessment.language = tmpl[:lang]
  assessment.created_by = user.id
  assessment.system_prompt ||= "You are an AI Assessor evaluating candidate competencies for #{tmpl[:name]}."

  if assessment.save
    # Assign 3-5 skills
    if assessment.assessment_skills.empty?
      sampled_skills = skills.sample(rand(3..5))
      sampled_skills.each_with_index do |sk, order|
        assessment.assessment_skills.create!(
          skill_id: sk.skill_id,
          skill_label: sk.skill_label,
          scope_include: sk.scope_include,
          scope_exclude: sk.scope_exclude,
          l1_anchor: sk.l1_anchor,
          l2_anchor: sk.l2_anchor,
          l3_anchor: sk.l3_anchor,
          l4_anchor: sk.l4_anchor,
          l5_anchor: sk.l5_anchor,
          expected_level: rand(2..4),
          display_order: order + 1
        )
      end
    end
    created_assessments << assessment
  end
end

puts "✓ #{created_assessments.size} Assessments available/seeded."

# ── 2. Create 25 Vacancies ──────────────────────────────────────────────────
vacancy_titles = [
  "Senior Frontend Engineer (React/TypeScript)",
  "Staff Backend Engineer (Ruby/Rails & Go)",
  "DevOps & SRE Engineer",
  "Product Technical Lead",
  "QA Automation Specialist",
  "Cloud Solutions Architect (AWS)",
  "Database Administrator (PostgreSQL)",
  "Junior Backend Developer",
  "Engineering Manager",
  "Principal Security Architect",
  "Senior Data Platform Engineer",
  "Scrum Master / Agile Delivery Lead",
  "Fullstack Web Developer",
  "Associate Software Engineer",
  "Lead Infrastructure Engineer",
  "Machine Learning Platform Engineer",
  "Cybersecurity Incident Responder",
  "Mobile iOS & Android Engineer",
  "Data Analyst - Growth & BI",
  "Enterprise Solutions Architect",
  "Frontend Core Systems Architect",
  "Platform Reliability Engineer",
  "AI & Voice Product Manager",
  "Information Security Compliance Lead",
  "Lead Ruby on Rails Developer"
]

vacancy_titles.each do |title|
  vacancy = Vacancy.unscoped.find_or_initialize_by(
    tenant_id: org.id,
    role_title: title
  )
  vacancy.created_by = user.id
  vacancy.culture_dimensions = "Collaborative, ownership mindset, curiosity, data-driven."
  vacancy.competency_expectations = "Demonstrated track record of delivering scalable systems and mentoring peers."

  if vacancy.save && vacancy.vacancy_skills.empty?
    skills.sample(rand(3..5)).each do |sk|
      vacancy.vacancy_skills.create!(
        skill_id: sk.skill_id,
        skill_label: sk.skill_label,
        expected_level: rand(2..4)
      )
    end
  end
end

puts "✓ #{vacancy_titles.size} Vacancies available/seeded."

# ── 3. Create 50 Candidates / Sessions for Assessments ───────────────────────
candidate_names = [
  "Budi Santoso", "Siti Rahmawati", "Ahmad Fauzi", "Dewi Lestari",
  "Kevin Pratama", "Jessica Tan", "Rizky Firmansyah", "Nadia Putri",
  "Farhan Maulana", "Maya Indah", "Dimas Anggara", "Putri Wulandari",
  "Bambang Wijaya", "Indah Permata", "Arif Rahman", "Clara Wijayanti",
  "Bayu Prasetyo", "Anisa Maharani", "Fajar Hidayat", "Tri Kusuma",
  "Agus Salim", "Ratna Sari", "Denny Setiawan", "Rina Melati",
  "Eko Supriyanto", "Dian Sastro", "Hendra Gunawan", "Fitri Handayani",
  "Reza Rahadian", "Gita Gutawa", "Irfan Bachdim", "Melati Daeva",
  "Christian Sugiono", "Chelsea Islan", "Nicholas Saputra", "Pevita Pearce",
  "Adipati Dolken", "Maudy Ayunda", "Raditya Dika", "Ernest Prakasa",
  "Sherina Munaf", "Vidi Aldiano", "Raisa Andriana", "Afgan Syahreza",
  "Tulus Rusydi", "Isyana Sarasvati", "Andmesh Kamaleng", "Lyodra Ginting",
  "Tiara Andini", "Ziva Magnolya"
]

target_assessment = created_assessments.first

candidate_names.each_with_index do |name, idx|
  status = case idx % 4
           when 0 then "pending"
           when 1 then "active"
           when 2 then "ended"
           when 3 then "ended"
           end

  end_reason = status == "ended" ? (idx.even? ? "all_covered" : "manual_candidate") : nil
  started_at = status != "pending" ? (idx * 20).minutes.ago : nil
  ended_at = status == "ended" ? started_at + rand(15..45).minutes : nil
  duration = ended_at ? (ended_at - started_at).to_i : (started_at ? (Time.current - started_at).to_i : nil)

  # Distribute among first few assessments, but put 25 in target_assessment for table density test
  assigned_assessment = idx < 25 ? target_assessment : created_assessments.sample

  session = Session.unscoped.find_or_initialize_by(
    tenant_id: org.id,
    assessment_id: assigned_assessment.id,
    candidate_name: name
  )

  session.status = status
  session.end_reason = end_reason
  session.started_at = started_at
  session.ended_at = ended_at
  session.duration_seconds = duration
  session.save!
end

puts "✓ #{candidate_names.size} Candidate Sessions seeded (including 25 in '#{target_assessment.name}')."
puts ""
puts "== Done Seeding Mock Data! =="
