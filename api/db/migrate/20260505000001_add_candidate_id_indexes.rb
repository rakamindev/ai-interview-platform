# frozen_string_literal: true

class AddCandidateIdIndexes < ActiveRecord::Migration[7.0]
    def change
        add_index :sessions, :candidate_id unless index_exists?(:sessions, :candidate_id)
        add_index :portfolios, :candidate_id unless index_exists?(:portfolios, :candidate_id)
    end
end
