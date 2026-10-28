# Momen verifikasi AI

| # | Klaim AI | Cara saya memverifikasi | Hasil |
|---|----------|-------------------------|-------|
| 1 | Link undangan lama mungkin tetap salah setelah APP_BASE_URL diubah | Membaca session.rb: invite_url dihitung ulang tiap dipanggil | Klaim salah |
| 2 | Portfolio mungkin tidak dibuat untuk sesi yang error | Membaca end_handler.rb dan Portfolio.pluck di console: portfolio dibuat tanpa syarat | Klaim salah |
| 3 | Laporan Fit/Gap lama tetap tampil setelah override sampai Regenerate ditekan | Override React ke L3, L4, L5 lalu buka Fit/Gap tanpa Regenerate; membaca portfolio_skills_controller.rb | Klaim salah: regenerate_stale_fitgap_reports menghapus laporan lama dan membuat ulang |
