# frozen_string_literal: true

# Satu baris riwayat perubahan level oleh asesor (F-05). Append-only.
class AssessorOverrideEvent < ApplicationRecord
  REASON_LENGTH = 10..1000

  belongs_to :portfolio_skill

  validates :previous_level, :new_level, :ai_level, numericality: { only_integer: true, in: 1..5 }
  validates :actor_id, presence: true
  # Event hasil backfill (legacy) boleh tanpa alasan karena berasal dari data lama.
  validates :reason, length: { in: REASON_LENGTH }, unless: :legacy?

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }

  # Entri yang sudah tersimpan tidak boleh diubah atau dihapus lewat aplikasi.
  # Penghapusan hanya terjadi lewat cascade database bersama skill-nya.
  def readonly?
    persisted?
  end
end
