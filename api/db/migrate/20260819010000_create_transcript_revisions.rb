class CreateTranscriptRevisions < ActiveRecord::Migration[7.0]
  def change
    create_table :transcript_revisions do |t|
      t.references :transcript_turn, null: false, foreign_key: true
      t.text :revised_text, null: false
      t.text :reason, null: false
      t.bigint :revised_by, null: false
      t.timestamps null: false
    end

    add_index :transcript_revisions, %i[transcript_turn_id created_at]
  end
end
