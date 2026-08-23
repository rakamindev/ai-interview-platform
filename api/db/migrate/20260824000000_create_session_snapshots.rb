# frozen_string_literal: true

class CreateSessionSnapshots < ActiveRecord::Migration[7.0]
  def change
    create_table :session_snapshots do |t|
      t.bigint :session_id, null: false
      t.datetime :captured_at, null: false
      t.text :image_data, null: false
    end

    add_index :session_snapshots, :session_id
  end
end
