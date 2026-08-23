# frozen_string_literal: true

# Organizations live in the public schema and are shared with rakamin-api.
# The Organization model is read-only by design, so tests insert rows directly
# (same approach as db/seeds.rb).
module TenantHelpers
  def create_organization!(scheme:, name: scheme.tr('-', ' ').titleize)
    q = ->(s) { ActiveRecord::Base.connection.quote(s) }
    ActiveRecord::Base.connection.select_value(<<~SQL).to_i
      INSERT INTO organizations (name, scheme, identifier, host, alias_hosts, config, created_at, updated_at)
      VALUES (#{q[name]}, #{q[scheme]}, #{q[scheme]}, #{q["#{scheme}.test"]}, '{}', '{}', now(), now())
      RETURNING id
    SQL
  end
end
