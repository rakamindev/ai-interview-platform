# frozen_string_literal: true

class AddIntegrityMetadataToSessions < ActiveRecord::Migration[7.0]
  # Session Trust & Context panel (W2): persist candidate-side integrity signals
  # (device state, network speed, reconnect events) that were previously only
  # held in the frontend/browser. Reversible and safe against existing rows.
  def up
    add_column :sessions, :integrity_metadata, :jsonb, null: false, default: {}
  end

  def down
    remove_column :sessions, :integrity_metadata
  end
end
