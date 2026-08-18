class AddPortfolioRatingStatus < ActiveRecord::Migration[7.0]
  def up
    add_column :portfolio_skills, :rating_status, :string
    execute <<~SQL
      UPDATE ai_interview.portfolio_skills
      SET rating_status = 'rated'
      WHERE rating_status IS NULL
    SQL
    change_column_default :portfolio_skills, :rating_status, from: nil, to: "rated"
    change_column_null :portfolio_skills, :rating_status, false

    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        ADD CONSTRAINT chk_portfolio_skills_rating_status
        CHECK (rating_status IN ('rated', 'not_assessed'))
    SQL
  end

  def down
    execute <<~SQL
      ALTER TABLE ai_interview.portfolio_skills
        DROP CONSTRAINT IF EXISTS chk_portfolio_skills_rating_status
    SQL

    remove_column :portfolio_skills, :rating_status
  end
end
