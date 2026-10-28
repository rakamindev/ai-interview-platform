# frozen_string_literal: true

# Fit/gap comparisons are now computed on read; the stored report only holds
# the AI narrative and its lifecycle. "outdated" is not stored: it is derived
# by comparing input_digest with the current inputs.
class AddNarrativeLifecycleToFitGapReports < ActiveRecord::Migration[7.0]
  STATUSES = %w[not_requested generating complete failed].freeze

  def up
    add_column :fit_gap_reports, :status, :string, limit: 20, null: false, default: 'not_requested'
    add_column :fit_gap_reports, :narrative_source, :string, limit: 20
    add_column :fit_gap_reports, :input_digest, :string, limit: 64
    add_column :fit_gap_reports, :error_code, :string, limit: 40
    add_column :fit_gap_reports, :requested_at, :datetime
    add_column :fit_gap_reports, :completed_at, :datetime
    change_column_null :fit_gap_reports, :skill_comparisons, true

    add_check_constraint :fit_gap_reports, "status IN (#{STATUSES.map { |s| "'#{s}'" }.join(', ')})",
                         name: 'chk_fit_gap_reports_status'
    add_check_constraint :fit_gap_reports, "narrative_source IS NULL OR narrative_source IN ('ai', 'legacy_fallback')",
                         name: 'chk_fit_gap_reports_narrative_source'

    # Existing reports are complete; the template sentence written when Gemini
    # failed is recognisable and is marked so it is never shown as AI text.
    execute <<~SQL.squish
      UPDATE fit_gap_reports SET status = 'complete', completed_at = generated_at,
        narrative_source = CASE
          WHEN culture_narrative IS NULL AND overall_narrative LIKE 'Candidate shows %' THEN 'legacy_fallback'
          ELSE 'ai'
        END
    SQL
  end

  def down
    execute "UPDATE fit_gap_reports SET skill_comparisons = '[]'::jsonb WHERE skill_comparisons IS NULL"
    change_column_null :fit_gap_reports, :skill_comparisons, false
    remove_check_constraint :fit_gap_reports, name: 'chk_fit_gap_reports_narrative_source'
    remove_check_constraint :fit_gap_reports, name: 'chk_fit_gap_reports_status'
    %i[completed_at requested_at error_code input_digest narrative_source status].each do |column|
      remove_column :fit_gap_reports, column
    end
  end
end
