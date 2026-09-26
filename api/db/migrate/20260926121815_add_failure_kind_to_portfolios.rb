# frozen_string_literal: true

# Records why a report failed, and when its status last changed, so the
# product can say what went wrong and notice a job that stopped.
class AddFailureKindToPortfolios < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolios, :failure_kind, :string
    add_column :portfolios, :status_changed_at, :datetime, null: false, default: -> { 'CURRENT_TIMESTAMP' }

    add_check_constraint :portfolios,
                         "failure_kind IS NULL OR failure_kind IN " \
                         "('model_unavailable', 'model_response_invalid', 'no_interview_data')",
                         name: 'chk_portfolios_failure_kind'

    execute 'UPDATE portfolios SET status_changed_at = generated_at WHERE generated_at IS NOT NULL'

    # Existing failures: without any transcript there was nothing to rate.
    # Otherwise the AI call failed, which was the only way to fail before.
    execute <<~SQL
      UPDATE portfolios p
      SET failure_kind = CASE
        WHEN EXISTS (SELECT 1 FROM transcript_turns t WHERE t.session_id = p.session_id)
          THEN 'model_unavailable'
        ELSE 'no_interview_data'
      END
      WHERE p.generation_status = 'failed'
    SQL
  end

  def down
    remove_check_constraint :portfolios, name: 'chk_portfolios_failure_kind'
    remove_column :portfolios, :status_changed_at
    remove_column :portfolios, :failure_kind
  end
end
