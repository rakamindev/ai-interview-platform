# Rencana implementasi reload/resume dan outcome kandidat

27 Oktober 2026. Melanjutkan instruksi pengguna untuk memperbaiki bug yang telah direproduksi. Tidak ada migrasi atau perubahan secret.

## Desain yang dipilih

1. Browser disconnect melepas kepemilikan koneksi lama: cancel timer, supersede dan close Gemini. Session record tetap bisa dilanjutkan; disconnect bukan End Interview. Timer grace lama yang otomatis mengakhiri sesi dihentikan. Konsekuensi: record active dapat tetap tersimpan ketika kandidat meninggalkan halaman; batas waktu asli diperiksa ketika resume dan abandoned-session cleanup menjadi pekerjaan operasional terpisah.
2. Gunakan handle tersimpan bila valid. Jika API secara spesifik menolak handle karena session not found/expired, buang handle dan lakukan satu fresh connection dengan konteks dari maksimal 40 turn tersimpan. Tidak mengarang transkrip dan tidak mengklaim audio in-flight terselamatkan. Error lain tetap mengikuti bounded retry/failure.
3. candidate_info mengirim end_reason dan sisa waktu dari started_at asli. UI membedakan selesai normal, error terminal, load error, dan koneksi putus; manual end menunggu acknowledgement, bukan langsung menampilkan sukses.

## Tugas berurutan

- Tambah spec lifecycle middleware, bentuk pesan restore context, dan kontrak candidate_info. Tambah tes UI ended/error, fetch failure/retry, WS terminal error/normal, intentional unmount, retry exhaustion, manual end acknowledgement.
- Jalankan baseline red dari source asli, simpan output. Hanya assertion failure yang relevan dihitung.
- Implementasikan cleanup disconnect, pemulihan handle invalid satu kali, guard callback lama, dan sisa waktu.
- Implementasikan state UI yang jujur dengan komponen existing. Perbaiki intentional WebSocket close supaya tidak menyalakan reconnect setelah unmount.
- Jalankan seluruh frontend/backend, TypeScript, build tanpa env lokal, dan browser smoke. Tinjau diff serta batas concurrency/partial history.
- Perbarui dokumentasi, evidence, scope/temuan; aktifkan backend setelah semua tes lulus. Uji Gemini/mikrofon nyata tetap dilakukan pengguna pada sesi baru; sesi ended/error lama tidak dihidupkan ulang.

## Opsi yang ditolak

- Hanya mengganti teks Complete: menyembunyikan akar kegagalan resume.
- Terus retry handle expired: sudah terbukti berulang 1008.
- Registry in-memory untuk berbagi koneksi lama: tidak andal lintas worker Puma.
- Membuat schema lease baru untuk satu tab: memperbesar scope; desain yang dipilih menghentikan pekerjaan koneksi yang sudah detach. Multi-tab bersamaan dan ownership lintas tab tetap tidak diklaim ditangani.

## Kriteria hasil

Koneksi lama tidak bisa menjadwalkan retry/end setelah detach; rejected handle tidak dipakai ulang dalam fallback; history tersimpan dipakai tanpa greeting ulang; UI ended/error bukan Complete; load/transport failure bukan sukses; end normal menunggu ack; resume tidak mereset waktu sesi. Tes deterministik dan tes live dibedakan.
