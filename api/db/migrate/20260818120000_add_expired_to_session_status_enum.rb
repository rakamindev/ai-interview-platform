# frozen_string_literal: true

class AddExpiredToSessionStatusEnum < ActiveRecord::Migration[7.0]
  disable_ddl_transaction!

  def up
    execute <<~SQL
      ALTER TYPE ai_interview.session_status ADD VALUE IF NOT EXISTS 'expired';
    SQL
  end

  def down
    # PostgreSQL does not support removing values from an enum type easily
  end
end
