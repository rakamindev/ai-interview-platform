# frozen_string_literal: true

# Every tenant check in this service reads the `scheme` claim out of a JWT, and
# login is where that claim is minted. It was minted from the caller's own
# `X-Tenant-Scheme` header, falling back to `SELECT scheme FROM organizations
# LIMIT 1` — neither of which has anything to do with the user signing in.
#
# The reason it was written that way is visible here: there was no column to
# read. Which organisation a user belongs to was never recorded, so the
# controller had nothing to answer the question with and asked the client
# instead. This is missing specification, not a typo — hence a migration rather
# than a one-line patch.
#
# Backfill deliberately reproduces the old implicit rule (lowest-id
# organisation) instead of guessing something cleverer. Existing rows keep the
# tenant they have been behaving as, so this migration cannot silently move an
# assessor's data; the header hole closes without a data change riding along
# with it. Assigning users to their real organisations is an operational task
# with information this service does not have.
class AddTenantIdToUsers < ActiveRecord::Migration[7.0]
  def up
    add_column :users, :tenant_id, :bigint

    default_tenant = select_value('SELECT id FROM public.organizations ORDER BY id LIMIT 1')

    if default_tenant.nil?
      orphans = select_value('SELECT COUNT(*) FROM ai_interview.users').to_i

      if orphans.positive?
        raise ActiveRecord::MigrationError,
              "#{orphans} user(s) exist but public.organizations is empty, so there is no " \
              'tenant to bind them to. Seed the organisations table before migrating.'
      end
    else
      execute <<~SQL.squish
        UPDATE ai_interview.users SET tenant_id = #{default_tenant.to_i} WHERE tenant_id IS NULL
      SQL
    end

    change_column_null :users, :tenant_id, false
    add_index :users, :tenant_id, name: 'idx_ai_interview_users_tenant_id'
  end

  def down
    remove_index :users, name: 'idx_ai_interview_users_tenant_id'
    remove_column :users, :tenant_id
  end
end
