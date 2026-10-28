# AGENTS.md — Working Rules

Dokumen ini wajib diikuti oleh AI coding agent dan developer yang membantu case study.

## 1. Source of truth

- Ikuti brief seleksi asli, lalu dokumen SOT ini sebagai struktur kerja.
- Repository aktual adalah sumber kebenaran untuk implementasi yang tersedia.
- Jangan mengasumsikan fitur, bug, schema, endpoint, atau package yang belum diverifikasi.
- Jika dokumen dan kode bertentangan, laporkan perbedaannya dan minta keputusan bila berdampak pada scope.

## 2. Phase-gated workflow

Kerjakan satu fase dalam satu waktu:
0. Setup.
1. Product/domain immersion.
2. Audit dan gap analysis.
3. Solusi dan acceptance criteria.
4. Implementasi.
5. Verifikasi.
6. Submission.

Di akhir setiap fase:
- Ringkas apa yang sudah diperiksa.
- Bedakan fakta terverifikasi, asumsi, dan pertanyaan terbuka.
- Tampilkan bukti/perintah yang benar-benar dijalankan.
- Laporkan blocker dan risiko.
- Ajukan permintaan persetujuan untuk pindah fase.

**Jangan pindah fase tanpa persetujuan eksplisit pengguna.** Jangan melakukan perubahan kode pada fase audit kecuali pengguna secara eksplisit meminta dan scope-nya jelas.

## 3. Repository safety

- Jangan commit langsung ke `main`.
- Gunakan feature branch.
- Jangan menghapus/menurunkan assertion agar test lulus.
- Jangan mengubah lockfile atau dependency tanpa alasan yang dijelaskan.
- Hindari refactor luas yang tidak terkait dengan masalah terpilih.
- Jangan merge PR kecuali diminta.
- Jangan menjalankan destructive command pada data pengguna atau environment bersama.
- Jangan mengasumsikan command tersedia; periksa README dan scripts terlebih dahulu.

## 4. Evidence discipline

- Jangan mengklaim test/build/lint berhasil jika belum menjalankannya.
- Catat command, hasil, dan kegagalan yang sebenarnya.
- Jangan menyatakan bug terkonfirmasi jika belum bisa direproduksi atau dibuktikan dari kode.
- Tandai temuan sebagai `confirmed`, `likely`, atau `unverified`.
- Jangan mengarang screenshot, benchmark, test coverage, URL, hasil AI, atau commit history.
- Jika environment mencegah pengujian, tulis keterbatasannya dengan jelas.

## 5. Engineering quality

- Pahami pola arsitektur dan konvensi proyek sebelum membuat perubahan.
- Validasi input di server; validasi frontend hanya untuk feedback pengguna, bukan pengganti server validation.
- Pastikan endpoint memiliki authorization sesuai konteks aplikasi.
- Tangani error, timeout, retry, duplicate jobs, dan partial writes bila relevan.
- Gunakan transaksi atau strategi konsistensi data yang sesuai.
- Migration harus mempertimbangkan existing rows dan reversible bila memungkinkan.
- Tambahkan test yang memverifikasi perilaku dan edge cases.
- Hindari logging data pribadi, token, API key, prompt sensitif, atau payload kandidat.
- Jangan menambahkan dependency baru tanpa membandingkan alternatif.

## 6. AI usage

- AI boleh digunakan sebagai alat bantu, bukan sumber kebenaran.
- Verifikasi kode yang dihasilkan AI dengan repository, dokumentasi, tests, atau eksperimen.
- Dokumentasikan minimal satu contoh saran AI yang salah/berisiko dan koreksinya berdasarkan kejadian nyata.
- Jangan mengklaim semua kode ditulis manual jika menggunakan AI; ikuti aturan disclosure yang diminta proses seleksi.

## 7. UI/UX

- Audit UI existing dan design system sebelum membuat desain baru.
- Pertahankan konsistensi komponen.
- Tangani loading, empty, error, partial, success, long text, dan responsive states yang relevan.
- Gunakan label yang jelas dan feedback yang dapat ditindaklanjuti.
- Jangan membuat data, skor, atau hasil penilaian fiktif terlihat sebagai hasil nyata.
- Screenshot harus memakai data sintetis dan tidak menampilkan informasi pribadi.

## 8. Privacy and security

- Jangan menaruh secret, API keys, credentials, atau data pribadi nyata di kode, commit, log, screenshots, atau laporan.
- Gunakan `.env` lokal yang tidak di-commit dan ikuti `.gitignore`.
- Jangan menyalin data kandidat produksi ke lingkungan development.
- Jika menemukan risiko privasi/keamanan, hentikan tindakan yang dapat memperburuknya dan laporkan.

## 9. Scope discipline

Satu vertical slice yang kuat lebih baik daripada banyak fitur setengah jadi.
Setiap perubahan harus terhubung dengan:
- Temuan yang terverifikasi.
- Pengguna yang terdampak.
- Acceptance criteria.
- Test atau metode verifikasi.
- Dampak dan trade-off yang terdokumentasi.

## 10. Format laporan akhir fase

Gunakan struktur:
1. Status fase.
2. Aktivitas yang dilakukan.
3. Fakta terverifikasi.
4. Temuan/bukti.
5. Asumsi dan pertanyaan terbuka.
6. Risiko/blocker.
7. Rekomendasi fase berikutnya.
8. Pertanyaan persetujuan: lanjut atau revisi?
