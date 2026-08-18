class DropUniqueIndexOnFitGapReports < ActiveRecord::Migration[7.0]
  def change
    remove_index :fit_gap_reports, [:portfolio_id, :vacancy_id],
                 name: 'index_fit_gap_reports_on_portfolio_id_and_vacancy_id'
    add_index :fit_gap_reports, [:portfolio_id, :vacancy_id],
              name: 'index_fit_gap_reports_on_portfolio_id_and_vacancy_id'
  end
end
