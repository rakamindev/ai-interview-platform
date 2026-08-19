class CreateInterviewReviewRecords < ActiveRecord::Migration[7.0]
  def change
    create_table :interview_recordings do |t|
      t.references :session, null: false, foreign_key: true, index: { unique: true }
      t.string :object_key, null: false
      t.string :content_type, null: false
      t.integer :byte_size, null: false
      t.integer :duration_ms
      t.string :checksum, null: false
      t.datetime :captured_at, null: false
      t.datetime :expires_at, null: false
      t.datetime :purged_at
      t.timestamps
    end
    add_index :interview_recordings, :object_key, unique: true

    create_table :portfolio_notes do |t|
      t.references :portfolio, null: false, foreign_key: true
      t.text :body, null: false
      t.string :category, null: false, default: 'review'
      t.bigint :created_by, null: false
      t.timestamps
    end
  end
end
