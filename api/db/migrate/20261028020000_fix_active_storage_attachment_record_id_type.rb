# frozen_string_literal: true

# ActiveStorage's generated migration derives its foreign-key column type from
# `Rails.configuration.generators` — and this app sets `primary_key_type: :uuid`
# there. That made `active_storage_attachments.record_id` a uuid column, while
# every AI-interview table (sessions, assessments, …) uses bigint primary keys.
#
# The result was silent and total: assigning an integer record id to a uuid
# column cast it to NULL, so every attachment insert died on the NOT NULL
# constraint. Candidates saw "CV upload failed" for every file, on every attempt.
#
# record_id must match the primary key type of the record it points at, so it
# becomes bigint here. active_storage_blobs.id and blob_id stay uuid — they only
# ever reference each other, so they are internally consistent.
class FixActiveStorageAttachmentRecordIdType < ActiveRecord::Migration[7.0]
  def up
    change_column :active_storage_attachments, :record_id, :bigint,
                  null: false, using: 'record_id::text::bigint'
  end

  def down
    change_column :active_storage_attachments, :record_id, :uuid,
                  null: false, using: 'record_id::text::uuid'
  end
end
