class CoverageMapReferencesTaxonomy < ActiveRecord::Migration[7.0]
  def change
    add_reference :coverage_maps, :skill_taxonomy, foreign: true
    remove_column :coverage_maps, :skill_label
    remove_column :coverage_maps, :skill_id
  end
end
