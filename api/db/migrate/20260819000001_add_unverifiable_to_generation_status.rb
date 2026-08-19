class AddUnverifiableToGenerationStatus < ActiveRecord::Migration[7.0]
  # DISCOVERED BY SPEC: the seeded-fault test (spec/services/sessions/end_handler_spec.rb)
  # hit PG::InvalidTextRepresentation because the generation_status PG enum lacked
  # 'unverifiable' — the entire transcript-quality guard was crashing at write time.
  disable_ddl_transaction!

  def up
    execute <<~SQL
      ALTER TYPE generation_status ADD VALUE IF NOT EXISTS 'unverifiable'
    SQL
  end

  def down
    # PostgreSQL cannot drop enum values; irreversible by design.
    raise ActiveRecord::IrreversibleMigration
  end
end