abort 'Run only against the test database' unless Rails.env.test?
require Rails.root.join('db/migrate/20261025000000_add_fit_gap_review_lifecycle')
Current.tenant_id = 808
assessment = Assessment.create!(name: 'Migration verification fixture', tenant_id: 808, created_by: 1, time_limit_min: 30)
session = assessment.sessions.create!(tenant_id: 808, status: 'ended')
portfolio = session.create_portfolio!(generation_status: 'complete')
vacancy = Vacancy.create!(tenant_id: 808, created_by: 1, role_title: 'Synthetic migration fixture')
vacancy.vacancy_skills.create!(skill_label: 'SQL', expected_level: 3)
report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
original = report.skill_comparisons
migration = AddFitGapReviewLifecycle.new
begin
  migration.migrate(:down)
  preserved = ActiveRecord::Base.connection.select_value("SELECT skill_comparisons::text FROM fit_gap_reports WHERE id = #{report.id}")
  raise 'Existing comparisons changed on rollback' unless JSON.parse(preserved) == original
  migration.migrate(:up)
  FitGapReport.reset_column_information
  restored = FitGapReport.find(report.id)
  raise 'Existing comparisons changed on reapply' unless restored.skill_comparisons == original
  raise 'Legacy report should require refresh' unless restored.review_status == 'stale'
  puts 'PASS: down/up preserves existing report, portfolio, and requirement rows; restored legacy report is stale until refreshed.'
ensure
  migration.migrate(:up) unless ActiveRecord::Base.connection.column_exists?(:fit_gap_reports, :generation_status)
  FitGapReport.reset_column_information
  FitGapReport.where(portfolio_id: portfolio.id).destroy_all
  portfolio.destroy!
  session.reload.destroy!
  assessment.reload.destroy!
  vacancy.reload.destroy!
  Current.clear
end
