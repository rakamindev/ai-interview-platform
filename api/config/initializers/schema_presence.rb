# frozen_string_literal: true

# db/schema.rb cannot hold the schema-creation statement: Rails regenerates
# that file after every migration, so a manual `CREATE SCHEMA` line is silently
# clobbered. Every table lives in the `ai_interview` schema (database.yml
# schema_search_path), so `db:schema:load` fails on a fresh database without it.
#
# Ensure the schema exists at boot instead. Cosmetic-only on any database where
# it already exists; raises nothing when the database does not exist yet
# (db:create / db:prepare handle that path).
begin
  ActiveRecord::Base.connection.execute("CREATE SCHEMA IF NOT EXISTS ai_interview")
rescue ActiveRecord::NoDatabaseError, PG::ConnectionBad => e
  Rails.logger.debug("ai_interview schema not created yet — database unavailable: #{e.message}")
end
