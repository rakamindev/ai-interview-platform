# frozen_string_literal: true

# `bin/rails db:migrate` (and db:prepare) silently substitute `db:schema:load`
# when the target database has no migrations recorded yet — Rails' own
# documented "faster and less error-prone" optimization (see db/schema.rb's
# header comment). That fast path's connection does not reliably apply
# database.yml's schema_search_path, so schema.rb's unqualified
# `create_table` calls land tables in `public` instead of `ai_interview`
# (confirmed: every app table ends up in `public` except the two Rails
# bookkeeping tables created before schema.rb runs).
#
# `db:create db:force_migrate` runs every migration file individually via
# ActiveRecord::MigrationContext, the same connection path normal app boots
# use (proven to apply search_path correctly) — bypassing the CLI shortcut
# entirely. Use this instead of db:prepare when bootstrapping a schema-less
# database (e.g. a fresh test DB).
namespace :db do
  desc "Run all pending migrations one by one, bypassing the db:schema:load fast path"
  task force_migrate: :environment do
    context = ActiveRecord::Base.connection_pool.migration_context
    context.migrate
    puts "db:force_migrate: now at version #{context.current_version}"
  end
end
