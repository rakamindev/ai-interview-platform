abort 'Test database only' unless Rails.env.test? && ActiveRecord::Base.connection_db_config.database == 'rakamin_test'
Rails.application.load_tasks
before = [Assessment.unscoped.count, Session.unscoped.count, Organization.count]
ActiveRecord::Base.transaction do
  Organization.find_or_create_by!(scheme: 'test-corp') { |o| o.name = 'Synthetic checkpoint'; o.identifier = 'checkpoint'; o.host = 'checkpoint.test' }
  create = Rake::Task['demo:portfolio_states']
  clear = Rake::Task['demo:portfolio_states:clear']
  clear.invoke
  create.invoke
  a = Assessment.unscoped.find_by!(name: 'Senior Frontend Engineer (demo)')
  raise 'Expected 8 sessions' unless Session.unscoped.where(assessment_id: a.id).count == 8
  clear.reenable; clear.invoke
  raise 'Demo assessment remains' if Assessment.unscoped.exists?(name: 'Senior Frontend Engineer (demo)')
  create.reenable; create.invoke
  a = Assessment.unscoped.find_by!(name: 'Senior Frontend Engineer (demo)')
  raise 'Expected 8 recreated sessions' unless Session.unscoped.where(assessment_id: a.id).count == 8
  raise ActiveRecord::Rollback
end
raise 'Rows changed after rollback' unless before == [Assessment.unscoped.count, Session.unscoped.count, Organization.count]
puts 'PASS: create -> clear -> recreate (8 states each), rolled back; original row counts preserved. No Gemini calls.'
