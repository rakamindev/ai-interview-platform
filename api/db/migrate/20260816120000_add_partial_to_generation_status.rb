# frozen_string_literal: true

# Adds the 'partial' state to the generation_status enum.
# A portfolio is 'partial' when some skills were saved but others failed
# validation (see Portfolios::Generator — best-effort save with explicit marker).
class AddPartialToGenerationStatus < ActiveRecord::Migration[7.0]
  def up
    execute "ALTER TYPE generation_status ADD VALUE IF NOT EXISTS 'partial';"
  end

  def down
    # Recreate the enum without 'partial'. The cast fails loudly if any row
    # actually uses the value, which is the honest outcome for a rollback.
    execute <<~SQL
      ALTER TYPE generation_status RENAME TO generation_status_old;
      CREATE TYPE generation_status AS ENUM ('pending', 'generating', 'complete', 'failed');
      ALTER TABLE portfolios
        ALTER COLUMN generation_status TYPE generation_status
        USING generation_status::text::generation_status;
      DROP TYPE generation_status_old;
    SQL
  end
end
