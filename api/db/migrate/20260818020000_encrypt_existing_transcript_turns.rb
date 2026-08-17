# frozen_string_literal: true

class EncryptExistingTranscriptTurns < ActiveRecord::Migration[7.0]
  def up
    # Re-saving each row runs it through TranscriptTurn's `encrypts :text`,
    # converting plaintext rows written before this feature shipped into
    # ciphertext. Batched to avoid locking the whole table at once.
    TranscriptTurn.unscoped.find_each(batch_size: 500) do |turn|
      turn.update!(text: turn.text)
    end
  end

  def down
    # Irreversible: decrypting back to plaintext on rollback would defeat the
    # point of this migration and there's no safe way to know which rows were
    # touched by `up` versus written after it.
  end
end
