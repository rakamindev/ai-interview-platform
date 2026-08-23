# frozen_string_literal: true

# Organizations live in the public schema and are owned by rakamin-api, which
# this service only reads. Specs therefore insert them with raw SQL rather
# than through a model, mirroring what db/seeds.rb does.
module TenantContext
  # Creates an organization and runs the block with it as the current tenant.
  def with_tenant(scheme: 'spec-corp', &block)
    tenant_id = create_organization(scheme: scheme)
    Current.tenant_id = tenant_id
    return tenant_id unless block

    begin
      block.call(tenant_id)
    ensure
      Current.tenant_id = tenant_id
    end
  end

  def create_organization(scheme: 'spec-corp')
    existing = ActiveRecord::Base.connection.select_one(
      ActiveRecord::Base.sanitize_sql_array(
        ['SELECT id FROM public.organizations WHERE scheme = ? LIMIT 1', scheme]
      )
    )
    return existing['id'].to_i if existing

    row = ActiveRecord::Base.connection.select_one(
      ActiveRecord::Base.sanitize_sql_array(
        [<<~SQL, scheme, scheme, scheme, scheme]
          INSERT INTO public.organizations
            (name, scheme, identifier, host, alias_hosts, config, created_at, updated_at)
          VALUES (?, ?, ?, ?, '{}', '{}', NOW(), NOW())
          RETURNING id
        SQL
      )
    )
    row['id'].to_i
  end

  # Switches the ambient tenant for the duration of the block.
  def as_tenant(tenant_id)
    previous = RequestStore.store[:tenant_id]
    Current.tenant_id = tenant_id
    yield
  ensure
    RequestStore.store[:tenant_id] = previous
  end
end
