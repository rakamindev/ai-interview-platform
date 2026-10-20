# frozen_string_literal: true

# Registers pgvector type support in ActiveRecord PostgreSQL adapter
ActiveSupport.on_load(:active_record) do
  ActiveRecord::ConnectionAdapters::PostgreSQLAdapter::NATIVE_DATABASE_TYPES[:vector] = { name: 'vector' }
end
