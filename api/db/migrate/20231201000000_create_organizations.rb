# frozen_string_literal: true

class CreateOrganizations < ActiveRecord::Migration[7.0]
  def change
    create_table :organizations do |t|
      t.string :name,        limit: 255, null: false
      t.string :scheme,      limit: 255, null: false
      t.string :identifier,  limit: 255, null: false
      t.string :host,        limit: 255, null: false
      t.string :alias_hosts, array: true, default: [], null: false
      t.jsonb  :config,      default: {}, null: false

      t.timestamptz :created_at, null: false, default: -> { 'now()' }
      t.timestamptz :updated_at, null: false, default: -> { 'now()' }
    end

    add_index :organizations, :scheme, unique: true
    add_index :organizations, :host
  end
end
