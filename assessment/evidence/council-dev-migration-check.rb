# frozen_string_literal: true

# Exercise the edited backfill on the development DB with synthetic legacy rows only.
# Temporary clones retain column constraints/indexes; existing tables and sequences are untouched.
# Foreign keys are not copied by PostgreSQL LIKE; the request spec uses the actual test schema.
# Usage from api: RAILS_ENV=development bundle exec rails runner ../assessment/evidence/council-dev-migration-check.rb
require Rails.root.join('db/migrate/20261106100001_backfill_portfolio_generations.rb')
abort 'Development database only' unless Rails.env.development?
connection = ActiveRecord::Base.connection
abort 'Unexpected database' unless connection.select_value('SELECT current_database()') == 'rakamin_development'
tables = %w[portfolios portfolio_generations portfolio_skills sessions assessment_skills]
before = tables.to_h { |t| [t, connection.select_value("SELECT count(*) FROM ai_interview.#{t}").to_i] }
connection.transaction do
  tables.each { |t| connection.execute("CREATE TEMP TABLE #{t} (LIKE ai_interview.#{t} INCLUDING ALL) ON COMMIT DROP") }
  connection.execute('CREATE TEMP SEQUENCE council_generation_ids')
  connection.execute("ALTER TABLE pg_temp.portfolio_generations ALTER COLUMN id SET DEFAULT nextval('pg_temp.council_generation_ids')")
  connection.execute("INSERT INTO pg_temp.sessions (id, tenant_id, assessment_id, invite_token, status) VALUES (1,1,1,'COUNCIL-SYNTHETIC-NONFUNCTIONAL','ended')")
  connection.execute("INSERT INTO pg_temp.assessment_skills (id,assessment_id,skill_label,l1_anchor,l2_anchor,l3_anchor,l4_anchor,l5_anchor) VALUES (1,1,'React','a1','a2','a3','a4','a5')")
  connection.execute("INSERT INTO pg_temp.portfolios (id,session_id,generation_status,generated_at) VALUES (1,1,'complete',now())")
  [['C++', true], ['C#', true], ['React', false], ['React', false], ['!!!', true], ['???', true]].each_with_index do |(label, discovered), i|
    connection.execute("INSERT INTO pg_temp.portfolio_skills (id,portfolio_id,skill_label,is_discovered,ai_level,ai_confidence,competency_summary) VALUES (#{i + 1},1,#{connection.quote(label)},#{discovered},3,'low','Synthetic legacy row')")
  end
  migration = BackfillPortfolioGenerations.new
  puts 'Scope: rakamin_development, temporary schema clones; no provider calls; rollback-only.'
  migration.up
  first = connection.select_rows('SELECT id,generation_id,skill_key FROM pg_temp.portfolio_skills ORDER BY id')
  raise 'Duplicate keys after up' unless first.map(&:last).uniq.length == 6
  raise 'First configured key changed' unless first[2].last == 'assessment_skill:1'
  puts "up: #{first.inspect}"
  migration.down
  raise 'Keys remain after down' unless connection.select_value('SELECT count(*) FROM pg_temp.portfolio_skills WHERE generation_id IS NOT NULL OR skill_key IS NOT NULL').to_i.zero?
  puts 'down: all 6 legacy rows retained; generation/key links cleared.'
  migration.up
  second = connection.select_rows('SELECT id,generation_id,skill_key FROM pg_temp.portfolio_skills ORDER BY id')
  raise 'Keys changed after repeat' unless first.map(&:last) == second.map(&:last)
  puts "up again: #{second.inspect}"
  raise ActiveRecord::Rollback
end
after = tables.to_h { |t| [t, connection.select_value("SELECT count(*) FROM ai_interview.#{t}").to_i] }
raise 'Existing table counts changed' unless before == after
puts 'PASS: up/down/up, unique keys and configured identity; transaction rolled back; original table counts unchanged.'
