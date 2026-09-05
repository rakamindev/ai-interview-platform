# frozen_string_literal: true

# Which path promoted a coverage map to `covered`: `analyzer` judged the
# evidence, `window_timeout` swept it forward on probe count alone.
#
# Existing rows keep NULL. We cannot tell which path set an already covered row,
# so backfilling would record a fact we do not have.
class AddCoveredByToCoverageMaps < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      DO $$ BEGIN
        CREATE TYPE ai_interview.coverage_promotion_source AS ENUM ('analyzer', 'window_timeout');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    SQL

    add_column :coverage_maps, :covered_by, 'ai_interview.coverage_promotion_source'
  end

  def down
    remove_column :coverage_maps, :covered_by
    execute 'DROP TYPE IF EXISTS ai_interview.coverage_promotion_source'
  end
end
