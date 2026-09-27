class AddFailureReasonToSessions < ActiveRecord::Migration[7.0]
  def up
    create_enum :session_failure_code, %w[assessment_invalid start_failed candidate_disconnected ai_connection_lost]

    change_table :sessions, bulk: true do |t|
      t.enum :failure_code, enum_type: :session_failure_code
      t.string :failure_detail, limit: 255
      t.datetime :failed_at
    end
  end

  def down
    change_table :sessions, bulk: true do |t|
      t.remove :failure_code, :failure_detail, :failed_at
    end

    execute 'DROP TYPE session_failure_code'
  end
end
