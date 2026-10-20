# frozen_string_literal: true

puts "== Resetting and Re-seeding Database =="

ActiveRecord::Base.transaction do
  puts "1. Clearing operational and evaluation data..."
  CandidateCvChunk.delete_all rescue nil
  FitGapReport.delete_all
  AssessorOverride.delete_all
  PortfolioSkill.delete_all
  Portfolio.delete_all
  CoverageMap.delete_all
  TranscriptTurn.delete_all
  Session.delete_all
  VacancySkill.delete_all
  Vacancy.delete_all
  AssessmentSkill.delete_all
  Assessment.delete_all
  SkillTaxonomy.delete_all

  puts "   All transactional and custom taxonomy tables cleared successfully."
end

puts ""
puts "2. Running db/seeds.rb (Organization, Skill Taxonomy, Admin User)..."
load Rails.root.join('db', 'seeds.rb')

puts ""
puts "3. Running db/seed_demo_session.rb (Initial Demo Assessment, Vacancy, Session & Portfolio)..."
load Rails.root.join('db', 'seed_demo_session.rb')

puts ""
puts "== Summary of Fresh Seeded State =="
puts "  Organizations   : #{Organization.count}"
puts "  Users           : #{User.count} (#{User.pluck(:email).join(', ')})"
puts "  Skill Taxonomies: #{SkillTaxonomy.count}"
puts "  Assessments     : #{Assessment.count} (#{Assessment.pluck(:id, :name).map { |id, n| "##{id} #{n}" }.join(', ')})"
puts "  Vacancies       : #{Vacancy.count} (#{Vacancy.pluck(:id, :role_title).map { |id, t| "##{id} #{t}" }.join(', ')})"
puts "  Sessions        : #{Session.count} (#{Session.pluck(:id, :candidate_name, :status).map { |id, n, s| "##{id} #{n} (#{s})" }.join(', ')})"
puts "  Portfolios      : #{Portfolio.count}"
puts "  FitGap Reports  : #{FitGapReport.count}"
puts "== Fresh start seed complete! =="
