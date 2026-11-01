# frozen_string_literal: true

class CreateDemoRequests < ActiveRecord::Migration[7.0]
  def change
    create_table :demo_requests do |t|
      t.string :name,    null: false, limit: 255
      t.string :email,   null: false, limit: 255
      t.string :company, null: false, limit: 255
      t.text   :message
      t.timestamps
    end
  end
end
