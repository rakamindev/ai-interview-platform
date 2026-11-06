# frozen_string_literal: true

# F-09: fit-gap report tidak lagi dihapus saat override. Kolom ini menyimpan status
# regenerasi agar laporan lama tetap bisa dibaca selama versi baru dibuat.
#
# - stale: laporan perlu diperbarui (override baru, atau laporan lama tanpa field baru)
# - generation_error: pesan generik bila regenerasi terakhir gagal
# - based_on_override_at: waktu override terbaru yang sudah tercermin di laporan
#   (dipakai worker untuk melewati job ganda)
# - regeneration_requested_at: membatasi frekuensi antrean saat laporan dibaca
#
# Data lama: semua laporan yang sudah ada belum memuat required_level/is_override,
# jadi ditandai stale agar diperbarui otomatis saat pertama kali dibaca.
class AddRegenerationStateToFitGapReports < ActiveRecord::Migration[7.0]
  def up
    change_table :fit_gap_reports, bulk: true do |t|
      t.boolean  :stale, null: false, default: false
      t.text     :generation_error
      t.datetime :based_on_override_at
      t.datetime :regeneration_requested_at
    end

    execute 'UPDATE fit_gap_reports SET stale = TRUE'
  end

  def down
    change_table :fit_gap_reports, bulk: true do |t|
      t.remove :stale, :generation_error, :based_on_override_at, :regeneration_requested_at
    end
  end
end
