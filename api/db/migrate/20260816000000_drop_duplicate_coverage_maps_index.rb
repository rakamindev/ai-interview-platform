# frozen_string_literal: true

class DropDuplicateCoverageMapsIndex < ActiveRecord::Migration[7.0]
  def up
    remove_index :coverage_maps, name: 'idx_coverage_session'
  end

  def down
    add_index :coverage_maps, :session_id, name: 'idx_coverage_session'
  end
end
