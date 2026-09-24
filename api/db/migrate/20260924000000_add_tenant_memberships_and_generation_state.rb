# frozen_string_literal: true

class AddTenantMembershipsAndGenerationState < ActiveRecord::Migration[7.0]
  def up
    execute "SET search_path TO ai_interview, public"

    create_table :tenant_memberships do |t|
      t.bigint :user_id, null: false
      t.bigint :organization_id, null: false
      t.string :role, null: false, default: 'assessor', limit: 20
      t.boolean :active, null: false, default: true
      t.timestamps null: false
    end
    add_index :tenant_memberships, %i[user_id organization_id], unique: true,
              name: 'idx_tenant_memberships_user_org'
    add_index :tenant_memberships, %i[organization_id active],
              name: 'idx_tenant_memberships_org_active'
    add_foreign_key :tenant_memberships, :users, column: :user_id
    execute <<~SQL
      ALTER TABLE ai_interview.tenant_memberships
      ADD CONSTRAINT fk_memberships_organizations
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
    SQL
    add_check_constraint :tenant_memberships, "role IN ('admin', 'assessor', 'user')",
                         name: 'chk_tenant_memberships_role'

    add_column :portfolio_skills, :assessment_status, :string, null: false,
               default: 'assessed', limit: 20
    add_column :portfolio_skills, :assessment_reason, :string, limit: 80
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_ai_level'
    add_check_constraint :portfolio_skills,
      "(assessment_status = 'assessed' AND ai_level BETWEEN 1 AND 5 AND ai_confidence IS NOT NULL) OR " +      "(assessment_status = 'not_assessed' AND ai_level IS NULL AND ai_confidence IS NULL)",
      name: 'chk_portfolio_skill_assessment_state'

    execute <<~SQL
      ALTER TABLE ai_interview.fit_gap_reports
      ADD COLUMN generation_status ai_interview.generation_status NOT NULL DEFAULT 'complete'
    SQL
    add_column :fit_gap_reports, :generation_error, :string, limit: 80
    add_column :fit_gap_reports, :generation_token, :string, limit: 36
    execute <<~SQL
      UPDATE ai_interview.fit_gap_reports
      SET skill_comparisons = (
        SELECT COALESCE(jsonb_agg(item || jsonb_build_object('is_override', false)), '[]'::jsonb)
        FROM jsonb_array_elements(skill_comparisons) AS elements(item)
      )
      WHERE jsonb_typeof(skill_comparisons) = 'array'
    SQL
    execute <<~SQL
      UPDATE ai_interview.fit_gap_reports AS reports
      SET generation_status = 'failed', generation_error = 'stale_contract'
      WHERE EXISTS (
        SELECT 1 FROM ai_interview.portfolio_skills AS skills
        JOIN ai_interview.assessor_overrides AS overrides ON overrides.portfolio_skill_id = skills.id
        WHERE skills.portfolio_id = reports.portfolio_id
      )
    SQL
  end

  def down
    if select_value("SELECT 1 FROM ai_interview.portfolio_skills WHERE assessment_status = 'not_assessed' LIMIT 1")
      raise ActiveRecord::IrreversibleMigration,
            'not_assessed skills have no AI level to restore to the previous non-null schema'
    end

    remove_column :fit_gap_reports, :generation_error
    remove_column :fit_gap_reports, :generation_token
    execute 'ALTER TABLE ai_interview.fit_gap_reports DROP COLUMN generation_status'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skill_assessment_state'
    change_column_null :portfolio_skills, :ai_level, false
    change_column_null :portfolio_skills, :ai_confidence, false
    add_check_constraint :portfolio_skills, 'ai_level >= 1 AND ai_level <= 5',
                         name: 'chk_portfolio_skills_ai_level'
    remove_column :portfolio_skills, :assessment_reason
    remove_column :portfolio_skills, :assessment_status
    drop_table :tenant_memberships
  end
end
