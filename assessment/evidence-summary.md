# Bukti implementasi dan pengujian - bahan laporan

Status: ringkasan berbasis evidence yang tersedia pada 27 Oktober 2026. Ini bukan pernyataan kesiapan produksi atau laporan audit keamanan.

## Teks ringkasan untuk laporan

Perubahan diuji pada batas frontend, backend, dan Web Audio browser. Suite terbaru setelah patch reload/outcome (E09) menghasilkan 25 tes frontend lulus dan 18 contoh backend dengan 0 kegagalan. E01/E02 merekam snapshot sebelumnya (14/8), bukan jumlah terbaru. Tes backend berjalan dalam container tanpa jaringan atau mount konfigurasi rahasia. TypeScript dan build Vite juga berhasil; build dijalankan dengan pemuatan file environment lokal dimatikan.

Pengujian browser menggunakan Edge dan input audio sintetis melalui hook capture/playback aplikasi. Hasilnya menunjukkan PCM16 16 kHz non-hening dapat ditangkap, mute/unmute bekerja, dan PCM24 kHz dapat dirender sampai antrean playback habis. Pengujian ini tidak menggunakan mikrofon asli atau memanggil Gemini, sehingga tidak menggantikan uji percakapan nyata.

Tes regresi direkam sebelum dan setelah perbaikan. Salah satu bukti paling langsung menjalankan processor audio asli: sampel suara pelan sebelumnya diubah menjadi nol dan 200 frame hening dipangkas menjadi 7 frame. Setelah perbaikan, sampel dipertahankan dan timeline hening diteruskan. Spec backend juga menangkap hilangnya sinyal giliran kandidat pada jalur resume browser serta penggunaan endpoint REST yang tidak sesuai contoh model preview.

Pengguna kemudian mengonfirmasi percakapan beberapa giliran dan halaman portfolio tampil. Metadata database sesi 18 menunjukkan status complete dan 3 skill tersimpan. Evidence live ini mendukung keberhasilan satu alur singkat, tetapi belum membuktikan stabilitas 45 menit, keandalan lintas browser/jaringan, atau validitas penilaian. Portfolio yang berhasil dibuat tetap menunjukkan temuan kualitas: skill tanpa evidence diberi L1; temuan tersebut dipisahkan dari keberhasilan teknis pipeline.

## Tabel yang dimasukkan ke PDF

| Area | Hasil | Referensi evidence |
| --- | --- | --- |
| Tes frontend terbaru | 25 lulus, exit 0 | E09; E01 snapshot sebelumnya |
| Tes backend terbaru | 18 contoh, 0 gagal, exit 0 | E09; E02 snapshot sebelumnya |
| Web Audio Edge sintetis | Capture, mute/unmute, playback/drain PASS | E03 |
| TypeScript dan Vite | Keduanya exit 0 | E04 |
| Snapshot verifikasi | Versi alat, image ID, source hashes | E05 |
| Fail-before-fix | Assertion failure dan green direkam untuk 7 tahap | R01-R07 |
| Percakapan live singkat | Dikonfirmasi pengguna | Observasi pengguna; screenshot/video belum dikemas |
| Portfolio | Sesi 18 complete; 3 skill; tampilan dikonfirmasi pengguna | Pemeriksaan metadata dan observasi pengguna |
| Fit/gap serta unduh/isi PDF-JSON | Diuji manual sesi 18; PDF dua halaman dan fit_gap_report terisi | E07; metadata/penilaian memiliki temuan terbuka |
| Seeded fault dengan Git history lokal | Baseline 8/0, fault 8/1, restore 8/0; assertion tidak berubah | E06; branch loma/seeded-fault-resume; publikasi masih diperlukan |

ID E01-E09 dan R01-R07 mengacu ke [indeks evidence](evidence/README.md). Saat PR tersedia, ganti rujukan internal pada PDF dengan tautan yang dapat dibuka reviewer.

## Contoh sebelum/sesudah yang paling mudah dipresentasikan

1. **Input pelan hilang:** processor asli mengganti sampel 0.005 menjadi 0. Tes gagal sebelum patch; setelah patch data PCM tetap ada. Ini membuktikan pemotongan input, bukan membuktikan setiap sesi macet mempunyai akar masalah yang sama.
2. **Resume tertahan mute:** callback ready untuk sesi existing hanya mengirim session_started. Tes mengharapkan speaker_changed:candidate dan gagal; setelah koreksi sinyal dikirim.
3. **Portfolio gagal integrasi:** tes transport memperlihatkan generateContent menuju /v1 alih-alih /v1beta. Setelah koreksi, tes URL lulus. Kuota nol dan model yang sudah berhenti merupakan hambatan terpisah yang harus diperiksa pada runtime.

## AI verification moment

AI menghasilkan fake timer Ruby `def fire = callback.call unless cancelled`, yang memicu NameError pada harness. Error harness diperiksa dan method ditulis multiline; barulah assertion failure produk dipakai sebagai evidence. Kode AI tidak diterima hanya karena tampak benar. Kesalahan rekomendasi model lama juga dikoreksi dengan memeriksa lifecycle model dan hasil runtime.

Source koreksi timer ada pada `api/spec/clients/gemini/live_client_spec.rb`; uraian proses terdapat pada `audio-fix.md`. Output kesalahan harness awal belum menjadi file evidence tersendiri, sehingga jangan menampilkan seolah tersedia sebagai lampiran independen.

## Batas dan pekerjaan tersisa

Tidak ada migrasi database dalam perubahan ini. Tidak ada bukti menyeluruh untuk keamanan endpoint, atomic partial writes, duplicate jobs, mobile, endurance, atau akurasi penilaian. Seeded fault lokal telah selesai; publikasi history-nya, PR, screenshot teranonimisasi, dan video 3-5 menit masih harus diselesaikan sebelum submission. Angka lulus mengacu pada snapshot yang diuji, bukan jaminan perubahan mendatang tidak dapat mengalami regresi.


Update ekspor: E07 mencatat fit/gap tampil, PDF berisi portfolio dan bagian fit/gap, serta JSON berisi target dan delta yang sesuai. Error lama generation_error tetap ada pada status complete (F12). Keberhasilan ekspor tidak menyelesaikan F09/F11 atau membuktikan QA visual layout sudah lengkap.

Update E08: pengguna mengonfirmasi Microphone Failed/Start nonaktif saat izin Block, lalu Passed/Start aktif setelah Allow + reload. Tombol Retry tetap macet (F02). Simulasi Force reconnect Gemini berhasil menunjukkan Reconnecting -> Connected dan respons AI kembali; transkrip pascareconnect belum dikonfirmasi terpisah. Hasil ini bukan bukti recovery gangguan jaringan nyata atau browser-resume.

Update M03: reload/resume manual gagal pada percobaan terbaru; pengguna tidak menekan End Interview tetapi melihat Complete. Metadata sesi terbaru ended/error dan retry Gemini habis memperkuat F01. Callback resume lulus unit/seeded-fault tidak membuktikan seluruh lifecycle resume berhasil. Gangguan Gemini juga terlihat sebelum browser disconnect, sehingga reload sebagai satu-satunya akar masalah belum terbukti. Lihat E08/M03 untuk batas dan korelasi.

Update live E09: pengguna mengonfirmasi sesi 23 akhirnya dapat dilanjutkan. Ini PASS terbatas setelah percobaan awal macet dan intervensi reconnect/mute; bukan klaim semua reload selalu pulih otomatis. Riwayat gagal tetap tersedia di manual-recovery-mobile.md.
