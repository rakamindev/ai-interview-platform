# frozen_string_literal: true

# db/schema.rb *does* now auto-regenerate its own `create_schema "ai_interview"`
# statement (Rails dumps a create_schema line for any non-public schema in
# schema_search_path) — so this initializer must NOT also create the schema:
# db:schema:load would then crash with PG::DuplicateSchema the moment both
# this initializer and schema.rb's own statement try to create it in the
# same run. schema.rb is the single source of truth for schema creation.
#
# What this initializer still needs to guarantee: the database's own
# search_path default is "ai_interview,public" *before* Rails' first
# connection to a brand-new database. database.yml's schema_search_path
# config key is not reliably honored by whichever connection db:create /
# db:schema:load use internally, so unqualified `create_table` calls in
# schema.rb can otherwise land in `public`. ALTER DATABASE sets Postgres's
# own per-database default, which every future connection picks up
# regardless of Rails' connection-handling internals.
begin
  db_name = ActiveRecord::Base.connection_db_config.database
  ActiveRecord::Base.connection.execute(
    "ALTER DATABASE #{ActiveRecord::Base.connection.quote_table_name(db_name)} " \
    "SET search_path TO ai_interview, public"
  )
rescue ActiveRecord::NoDatabaseError, ActiveRecord::ConnectionNotEstablished, PG::ConnectionBad => e
  Rails.logger.debug { "ai_interview search_path not set — database unavailable: #{e.message}" }
end
