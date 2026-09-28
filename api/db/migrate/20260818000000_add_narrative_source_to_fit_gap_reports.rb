# frozen_string_literal: true

class AddNarrativeSourceToFitGapReports < ActiveRecord::Migration[7.0]
  def up
    add_column :fit_gap_reports, :narrative_source, :string, limit: 30

    execute <<~SQL.squish
      UPDATE fit_gap_reports
      SET narrative_source = CASE
        WHEN culture_narrative IS NULL OR BTRIM(culture_narrative) = ''
          THEN 'rule_based_fallback'
        ELSE 'ai'
      END
    SQL

    change_column_null :fit_gap_reports, :narrative_source, false
    change_column_default :fit_gap_reports, :narrative_source, from: nil, to: 'ai'
    add_check_constraint :fit_gap_reports,
                         "narrative_source IN ('ai', 'rule_based_fallback')",
                         name: 'chk_fit_gap_reports_narrative_source'
  end

  def down
    remove_check_constraint :fit_gap_reports, name: 'chk_fit_gap_reports_narrative_source'
    remove_column :fit_gap_reports, :narrative_source
  end
end
