class PortfolioReferencesSkillTaxonomy < ActiveRecord::Migration[7.0]
  def change
    add_reference :portfolio_skills, :skill_taxonomy, foreign_key: true
    remove_column :portfolio_skills, :skill_id
    remove_column :portfolio_skills, :skill_label
  end
end
