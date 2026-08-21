# frozen_string_literal: true

# API-IMP-03: Add foreign key constraints on tenant and audit relationships.
#
# Pre-migration orphan check:
# Run the following SQL before applying to verify zero orphaned rows:
#
#   SELECT COUNT(*) FROM assessments a LEFT JOIN organizations o ON a.tenant_id = o.id WHERE o.id IS NULL;
#   SELECT COUNT(*) FROM vacancies v LEFT JOIN organizations o ON v.tenant_id = o.id WHERE o.id IS NULL;
#   SELECT COUNT(*) FROM sessions s LEFT JOIN organizations o ON s.tenant_id = o.id WHERE o.id IS NULL;
#   SELECT COUNT(*) FROM portfolios p LEFT JOIN organizations o ON p.tenant_id = o.id WHERE o.id IS NULL;
#   SELECT COUNT(*) FROM portfolio_skills ps LEFT JOIN organizations o ON ps.tenant_id = o.id WHERE o.id IS NULL;
#   SELECT COUNT(*) FROM fit_gap_reports fgr LEFT JOIN organizations o ON fgr.tenant_id = o.id WHERE o.id IS NULL;
#   SELECT COUNT(*) FROM assessor_overrides ao LEFT JOIN organizations o ON ao.tenant_id = o.id WHERE o.id IS NULL;
#   SELECT COUNT(*) FROM assessor_override_events aoe LEFT JOIN organizations o ON aoe.tenant_id = o.id WHERE o.id IS NULL;
#   SELECT COUNT(*) FROM assessments a LEFT JOIN users u ON a.created_by = u.id WHERE u.id IS NULL;
#   SELECT COUNT(*) FROM vacancies v LEFT JOIN users u ON v.created_by = u.id WHERE u.id IS NULL;
#   SELECT COUNT(*) FROM assessor_override_events aoe LEFT JOIN portfolio_skills ps ON aoe.portfolio_skill_id = ps.id WHERE ps.id IS NULL;
#
# All queries must return 0 before running this migration.

class AddForeignKeyConstraints < ActiveRecord::Migration[7.0]
  def up
    # tenant_id → organizations.id on all tenant-scoped tables
    add_foreign_key :assessments, :organizations, column: :tenant_id
    add_foreign_key :vacancies, :organizations, column: :tenant_id
    add_foreign_key :sessions, :organizations, column: :tenant_id
    add_foreign_key :portfolios, :organizations, column: :tenant_id
    add_foreign_key :portfolio_skills, :organizations, column: :tenant_id
    add_foreign_key :fit_gap_reports, :organizations, column: :tenant_id
    add_foreign_key :assessor_overrides, :organizations, column: :tenant_id
    add_foreign_key :assessor_override_events, :organizations, column: :tenant_id

    # created_by → users.id on assessments and vacancies
    add_foreign_key :assessments, :users, column: :created_by
    add_foreign_key :vacancies, :users, column: :created_by

    # portfolio_skill_id → portfolio_skills.id on assessor_override_events
    add_foreign_key :assessor_override_events, :portfolio_skills
  end

  def down
    remove_foreign_key :assessor_override_events, :portfolio_skills
    remove_foreign_key :vacancies, :users
    remove_foreign_key :assessments, :users
    remove_foreign_key :assessor_override_events, :organizations, column: :tenant_id
    remove_foreign_key :assessor_overrides, :organizations, column: :tenant_id
    remove_foreign_key :fit_gap_reports, :organizations, column: :tenant_id
    remove_foreign_key :portfolio_skills, :organizations, column: :tenant_id
    remove_foreign_key :portfolios, :organizations, column: :tenant_id
    remove_foreign_key :sessions, :organizations, column: :tenant_id
    remove_foreign_key :vacancies, :organizations, column: :tenant_id
    remove_foreign_key :assessments, :organizations, column: :tenant_id
  end
end
