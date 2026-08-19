# frozen_string_literal: true

# Injects sample data for local testing / Postman:
#   - 1 admin user (email + password) so /api/v1/auth/login works
#   - 3 assessments, 3 sessions, 3 portfolios (with skills), 3 vacancies
#
# Idempotent: safe to re-run. Run with:
#   bundle exec rails runner db/sample_data.rb

# ── Tenant ───────────────────────────────────────────────────────────────────
org_row = ActiveRecord::Base.connection.select_one(
  "SELECT id FROM public.organizations WHERE scheme = 'test-corp' LIMIT 1"
)
tenant_id = org_row['id'].to_i
Current.tenant_id = tenant_id
RequestStore.store[:tenant_id] = tenant_id
puts "Using tenant_id=#{tenant_id} (scheme=test-corp)"

# ── 1. Admin user (login works) ──────────────────────────────────────────────
admin = User.find_or_initialize_by(email: 'admin@testcorp.com')
if admin.new_record?
  admin.password = 'password123'
  admin.role     = 'admin'
  admin.save!
  puts "Created admin user id=#{admin.id} (admin@testcorp.com / password123)"
else
  admin.update!(role: 'admin') unless admin.role == 'admin'
  puts "Admin user already exists id=#{admin.id} (admin@testcorp.com / password123)"
end

# ── 2. Assessments ───────────────────────────────────────────────────────────
assessment_defs = [
  { name: 'Backend Engineer Assessment',  time_limit_min: 60, language: 'en' },
  { name: 'Frontend Engineer Assessment', time_limit_min: 45, language: 'en' },
  { name: 'Data Scientist Assessment',    time_limit_min: 90, language: 'en' }
]
assessments = assessment_defs.map do |defn|
  Assessment.find_or_create_by!(name: defn[:name]) do |rec|
    rec.created_by     = admin.id
    rec.time_limit_min = defn[:time_limit_min]
    rec.language       = defn[:language]
  end
end
puts "Assessments: #{assessments.map(&:id).inspect}"

# ── 3. Sessions (one per assessment) ────────────────────────────────────────
session_defs = [
  { candidate_name: 'Alice Candidate', status: 'active' },
  { candidate_name: 'Bob Candidate',   status: 'active' },
  { candidate_name: 'Carol Candidate', status: 'pending' }
]
sessions = assessments.zip(session_defs).map do |assessment, sdef|
  Session.find_or_create_by!(assessment: assessment, candidate_name: sdef[:candidate_name]) do |rec|
    rec.status     = sdef[:status]
    rec.started_at = Time.now if sdef[:status] == 'active'
  end
end
puts "Sessions: #{sessions.map(&:id).inspect}"

# ── 4. Portfolios (one per session) + sample skills ──────────────────────────
taxonomies = SkillTaxonomy.limit(6).to_a
portfolios = sessions.map.with_index do |session, i|
  portfolio = Portfolio.find_or_create_by!(session: session) do |rec|
    rec.generation_status = 'complete'
    rec.generated_at      = Time.now
  end
  %w[high medium].each_with_index do |conf, j|
    tax = taxonomies[(i * 2 + j) % taxonomies.size]
    PortfolioSkill.find_or_create_by!(portfolio: portfolio, skill_label: tax.skill_label) do |rec|
      rec.skill_id          = tax.skill_id
      rec.is_discovered     = false
      rec.ai_level          = [3, 4, 5].sample
      rec.ai_confidence     = conf
      rec.evidence          = ['Demonstrated competency during the live interview.']
      rec.competency_summary = "Solid working knowledge of #{tax.skill_label}."
    end
  end
  portfolio
end
puts "Portfolios: #{portfolios.map(&:id).inspect}"

# ── 5. Vacancies ─────────────────────────────────────────────────────────────
vacancy_defs = [
  { role_title: 'Senior Backend Engineer' },
  { role_title: 'Frontend Engineer' },
  { role_title: 'Machine Learning Engineer' }
]
vacancies = vacancy_defs.map do |vdef|
  Vacancy.find_or_create_by!(role_title: vdef[:role_title]) do |rec|
    rec.created_by = admin.id
  end
end
puts "Vacancies: #{vacancies.map(&:id).inspect}"

puts "\nDONE. Login with: admin@testcorp.com / password123"
