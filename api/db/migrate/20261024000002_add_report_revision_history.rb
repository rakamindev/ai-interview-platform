class AddReportRevisionHistory < ActiveRecord::Migration[7.0]
  def change
    create_table :portfolio_revisions do |t|
      t.references :portfolio, null: false, foreign_key: true
      t.integer :version, null: false
      t.string :generation_status, null: false
      t.datetime :generated_at
      t.text :generation_error
      t.jsonb :snapshot, null: false, default: {}
      t.timestamps
    end

    add_index :portfolio_revisions, [:portfolio_id, :version], unique: true

    remove_index :fit_gap_reports,
                 name: 'index_fit_gap_reports_on_portfolio_id_and_vacancy_id'
    add_column :fit_gap_reports, :version, :integer, null: false, default: 1
    add_index :fit_gap_reports, [:portfolio_id, :vacancy_id, :version], unique: true,
              name: 'idx_fit_gap_reports_revision'
  end
end
