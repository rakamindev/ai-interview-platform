# frozen_string_literal: true

class AddIndexesToOrganizations < ActiveRecord::Migration[7.0]
  def change
    add_index :organizations, :scheme, unique: true unless index_exists?(:organizations, :scheme)
    add_index :organizations, :host unless index_exists?(:organizations, :host)
  end
end
