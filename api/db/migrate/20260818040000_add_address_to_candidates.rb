# frozen_string_literal: true

class AddAddressToCandidates < ActiveRecord::Migration[7.0]
  def change
    add_column :candidates, :address, :text
  end
end
