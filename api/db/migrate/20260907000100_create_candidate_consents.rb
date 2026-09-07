# frozen_string_literal: true

# A candidate is recorded, transcribed, assessed by a model, and has their
# speech sent to a third party, and nothing in this system ever told them so or
# kept a record that it had.
#
# UU PDP No. 27/2022 Pasal 20 requires a lawful basis and Pasal 21 requires the
# subject be informed before processing begins. An unrecorded consent is not a
# consent: if it cannot be produced later, it did not happen.
#
# disclosure_version is stored per row rather than assumed. When the wording
# changes, historical consents stay traceable to the text the candidate actually
# read, which is the only way a record like this is worth keeping.
#
# Safe against existing rows: a new table, referenced by nothing. Sessions that
# predate it simply have no consent record, which is the truth about them.
class CreateCandidateConsents < ActiveRecord::Migration[7.0]
  def change
    create_table :candidate_consents do |t|
      t.bigint  :session_id,        null: false
      t.string  :disclosure_version, null: false, limit: 20
      t.datetime :granted_at,       null: false, default: -> { 'now()' }

      # Kept because a consent record that cannot be attributed is not evidence
      # of anything. Deliberately not the candidate's name or any interview
      # content: this table exists to prove a disclosure was shown, and holding
      # more than that would work against the law it serves.
      t.string  :ip_address, limit: 45
      t.string  :user_agent, limit: 255

      t.timestamps
    end

    add_index :candidate_consents, :session_id, unique: true
    add_foreign_key :candidate_consents, :sessions
  end
end
