# frozen_string_literal: true

class CreateCandidateCvChunks < ActiveRecord::Migration[7.0]
  def change
    enable_extension 'vector' unless extension_enabled?('vector')

    create_table :candidate_cv_chunks do |t|
      t.references :session, null: false, foreign_key: { on_delete: :cascade }
      t.bigint :tenant_id, null: false
      t.integer :chunk_index, null: false
      t.text :content, null: false
      t.string :section_type, limit: 100
      t.column :embedding, 'vector(768)'
      t.jsonb :metadata, default: {}, null: false

      t.timestamps
    end

    add_foreign_key :candidate_cv_chunks, :organizations, column: :tenant_id, on_delete: :cascade
    add_index :candidate_cv_chunks, :tenant_id
    add_index :candidate_cv_chunks, %i[session_id chunk_index], unique: true

    reversible do |dir|
      dir.up do
        execute <<-SQL
          CREATE INDEX idx_cv_chunks_embedding ON candidate_cv_chunks USING hnsw (embedding vector_cosine_ops);
        SQL
      end
    end
  end
end
