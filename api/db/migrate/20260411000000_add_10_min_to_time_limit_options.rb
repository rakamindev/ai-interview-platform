# frozen_string_literal: true

class Add10MinToTimeLimitOptions < ActiveRecord::Migration[7.0]
  def up
    execute "ALTER TABLE assessments DROP CONSTRAINT chk_assessments_time_limit"
    execute "ALTER TABLE assessments ADD CONSTRAINT chk_assessments_time_limit CHECK (time_limit_min = ANY (ARRAY[10, 30, 45, 60, 90]))"
  end

  def down
    count = ActiveRecord::Base.connection.select_value(
      "SELECT count(*) FROM assessments WHERE time_limit_min = 10"
    )
    if count.positive?
      execute "UPDATE assessments SET time_limit_min = 30 WHERE time_limit_min = 10"
      Rails.logger.warn("Migrated #{count} assessment(s) from 10-minute to 30-minute on rollback.")
    end
    execute "ALTER TABLE assessments DROP CONSTRAINT chk_assessments_time_limit"
    execute "ALTER TABLE assessments ADD CONSTRAINT chk_assessments_time_limit CHECK (time_limit_min = ANY (ARRAY[30, 45, 60, 90]))"
  end
end
