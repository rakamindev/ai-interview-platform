# frozen_string_literal: true

class Add10MinToTimeLimitOptions < ActiveRecord::Migration[7.0]
    def up
        execute 'ALTER TABLE assessments DROP CONSTRAINT chk_assessments_time_limit'
        execute 'ALTER TABLE assessments ADD CONSTRAINT chk_assessments_time_limit CHECK (time_limit_min = ANY (ARRAY[10, 30, 45, 60, 90]))'
    end

    def down
        execute 'ALTER TABLE assessments DROP CONSTRAINT chk_assessments_time_limit'
        execute 'ALTER TABLE assessments ADD CONSTRAINT chk_assessments_time_limit CHECK (time_limit_min = ANY (ARRAY[30, 45, 60, 90]))'
    end
end
