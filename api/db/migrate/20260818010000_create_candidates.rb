# frozen_string_literal: true

class CreateCandidates < ActiveRecord::Migration[7.0]
  def change
    create_table :candidates do |t|
      t.bigint :tenant_id, null: false
      t.string :email, limit: 255, null: false
      t.string :name, limit: 255
      t.string :phone, limit: 50
      t.timestamps
    end

    add_index :candidates, %i[tenant_id email], unique: true
  end
end
