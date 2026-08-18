# frozen_string_literal: true

# This migration comes from active_storage (originally 20170806125915), hand-fixed:
#
#   - Converted to def up/def down with the SET search_path prologue, matching this
#     repo's convention for schema-creating migrations (schema placement should be
#     intentional, not an accident of database.yml's search_path).
#   - record_id is forced to :bigint, NOT the config.generators primary_key_type: :uuid
#     setting the unmodified generator template would have used. Every actual domain
#     table in this app uses bigint PKs (the uuid generator setting is unused
#     elsewhere) — left alone, active_storage_attachments.record_id would be uuid and
#     could never join to cv_screening_entries.id. The other uuid PKs here (blobs,
#     attachments, variant_records themselves) are internally self-consistent and
#     fine to leave as uuid; record_id is the one column that must match.
class CreateActiveStorageTables < ActiveRecord::Migration[7.0]
  def up
    execute 'SET search_path TO ai_interview, public'

    create_table :active_storage_blobs, id: :uuid do |t|
      t.string   :key,          null: false
      t.string   :filename,     null: false
      t.string   :content_type
      t.text     :metadata
      t.string   :service_name, null: false
      t.bigint   :byte_size,    null: false
      t.string   :checksum
      t.datetime :created_at, precision: 6, null: false

      t.index [:key], unique: true
    end

    create_table :active_storage_attachments, id: :uuid do |t|
      t.string :name, null: false
      t.references :record, null: false, polymorphic: true, index: false, type: :bigint
      t.references :blob, null: false, type: :uuid

      t.datetime :created_at, precision: 6, null: false

      t.index [:record_type, :record_id, :name, :blob_id],
              name: :index_active_storage_attachments_uniqueness, unique: true
      t.foreign_key :active_storage_blobs, column: :blob_id
    end

    create_table :active_storage_variant_records, id: :uuid do |t|
      t.belongs_to :blob, null: false, index: false, type: :uuid
      t.string :variation_digest, null: false

      t.index [:blob_id, :variation_digest],
              name: :index_active_storage_variant_records_uniqueness, unique: true
      t.foreign_key :active_storage_blobs, column: :blob_id
    end
  end

  def down
    drop_table :active_storage_variant_records
    drop_table :active_storage_attachments
    drop_table :active_storage_blobs
  end
end
