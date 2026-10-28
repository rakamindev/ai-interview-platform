# Product Requirements Document (PRD)
## Case Study: Fullstack Product Engineer — AI Interview Platform

**Status:** Draft kerja — perlu divalidasi melalui inspeksi repository dan penggunaan aplikasi  
**Repository:** https://github.com/rakamindev/ai-interview-platform  
**Jenis pekerjaan:** Audit produk dan implementasi satu peningkatan fullstack yang bernilai tinggi

---

## 1. Ringkasan

Tugas ini meminta engineer memahami produk AI interview/assessment yang sudah ada, menemukan kesenjangan antara kondisi sekarang dan kondisi ideal, memilih solusi berdasarkan dampak serta biaya, lalu mengimplementasikan perubahan lintas backend dan frontend dengan pengujian otomatis serta bukti yang dapat ditinjau.

Ini bukan instruksi untuk membangun aplikasi baru dari nol. Fitur final **belum ditentukan**: keputusan harus didasarkan pada temuan nyata setelah repository dijalankan dan workflow diuji.

## 2. Konteks produk dari brief

Repository memiliki dua service:

- `api/`: Ruby on Rails, PostgreSQL, Sidekiq, RSpec, dan Gemini AI.
- `web/`: React 18, TypeScript, Vite, Tailwind CSS, dan Radix UI.

Kelompok pengguna yang disebut dalam brief:
- Assessor
- Recruiter
- Hiring manager
- Kandidat yang menjalani penilaian, termasuk pihak terdampak yang mungkin tidak memilih untuk menggunakan produk.

Produk bekerja pada konteks hiring dan talent assessment di Indonesia. Pengalaman kandidat, keandalan hasil penilaian, serta perlindungan data pribadi harus menjadi bagian dari keputusan produk.

## 3. Masalah yang hendak diselesaikan

**Masalah spesifik belum boleh ditetapkan sebelum audit.** Tim harus mengidentifikasi kesenjangan yang benar-benar dapat direproduksi pada workflow, data, API, atau antarmuka.

Rumusan masalah final harus menjawab:
1. Siapa yang terdampak?
2. Pada langkah workflow mana masalah terjadi?
3. Perilaku aktual apa yang diamati?
4. Perilaku ideal apa yang seharusnya terjadi?
5. Apa dampaknya terhadap keputusan atau pengalaman pengguna?
6. Bukti apa yang mendukung temuan tersebut?
7. Apakah ini missing specification atau defective implementation?

## 4. Tujuan

- Memahami workflow produk secara end-to-end.
- Menemukan dan memprioritaskan masalah berdasarkan dampak.
- Menetapkan acceptance criteria sebelum coding.
- Membandingkan minimal 2–3 opsi solusi.
- Mengirim perubahan yang mencakup backend dan frontend.
- Menambahkan pengujian otomatis yang dapat mendeteksi regresi.
- Menangani edge cases dan failure paths secara eksplisit.
- Menjaga keamanan data, migrasi, dan otorisasi.
- Menyediakan bukti engineering dan product craft melalui PR, PDF, screenshot, serta video.

## 5. Bukan tujuan

- Mengganti seluruh arsitektur tanpa kebutuhan yang terbukti.
- Menambah fitur hanya agar jumlah perubahan terlihat besar.
- Mengklaim masalah yang belum direproduksi.
- Mengubah atau melemahkan assertion hanya agar tes lolos.
- Memasukkan data pribadi nyata atau secret ke kode, log, screenshot, atau commit.
- Mengirim kode yang tidak dapat dijelaskan oleh kandidat.

## 6. Prinsip produk

### 6.1 Keputusan berbasis bukti
Setiap masalah harus memiliki langkah reproduksi, bukti, dampak, dan severity.

### 6.2 Dampak di atas jumlah baris kode
Pilih peningkatan dengan manfaat nyata bagi pengguna dan kandidat, bukan sekadar perubahan terbesar.

### 6.3 Kandidat ikut dipertimbangkan
Hasil penilaian dapat memengaruhi kesempatan seseorang. Hindari menyamarkan ketidakpastian atau data yang belum lengkap sebagai kesimpulan pasti.

### 6.4 Privasi sejak awal
Pertimbangkan UU Perlindungan Data Pribadi (UU PDP). Jangan gunakan data kandidat nyata pada fixture atau bukti. Audit log dan payload agar tidak membocorkan informasi sensitif.

### 6.5 Transparansi kegagalan
Kegagalan model, timeout, data parsial, dan input tidak valid harus menghasilkan perilaku yang dapat dipahami serta tidak merusak data.

## 7. Ruang lingkup implementasi

Setelah audit, pilih **satu vertical slice** yang:
- Berdampak cukup tinggi.
- Dapat diselesaikan dalam waktu yang tersedia.
- Melibatkan backend dan frontend.
- Memiliki acceptance criteria yang dapat diuji.
- Memiliki failure modes yang dapat ditangani.
- Tidak memerlukan refactor luas yang tidak relevan.

Komponen yang mungkin terdampak, bergantung temuan:
- API/controller/service dan validasi.
- Model/database/migration.
- Background jobs atau integrasi Gemini AI.
- Frontend screen/components/state.
- Automated tests.
- Dokumentasi, screenshots, dan video.

Jangan menganggap semua komponen di atas harus diubah. Perubahan data model hanya dilakukan jika memang diperlukan.

## 8. Tingkat severity temuan

Gunakan severity P0–P3 dan jelaskan dampak nyata. Definisi berikut adalah konvensi kerja untuk konsistensi laporan:

| Level | Panduan |
|---|---|
| P0 — Critical | Risiko serius pada fungsi inti, integritas data, keamanan, atau hasil penilaian; perlu ditangani segera. |
| P1 — High | Workflow inti rusak atau hasil penting tidak dapat dipercaya; dampak besar pada pengguna. |
| P2 — Medium | Gangguan terbatas atau workaround tersedia, tetapi tetap menurunkan kualitas produk. |
| P3 — Low | Penyempurnaan minor, polish, atau masalah dengan dampak rendah. |

Jangan memberi severity hanya berdasarkan intuisi; catat alasan dan bukti.

## 9. Acceptance criteria

Acceptance criteria final harus ditulis berdasarkan temuan sebelum implementasi. Pertimbangkan, bila relevan:
- Input valid dan invalid.
- Data kosong atau belum lengkap.
- Rating/skill yang belum dinilai.
- Data dengan tipe tidak sesuai.
- Respons API gagal atau timeout.
- Kegagalan panggilan model AI.
- Job duplikat atau retry.
- Partial write dan kegagalan transaksi.
- Pengguna tanpa izin.
- Teks panjang, layout overflow, dan responsive state.
- Data lama yang sudah ada saat migration dijalankan.
- Tidak ada informasi pribadi sensitif pada log.

Setiap kriteria perlu memiliki cara verifikasi dan hasil yang diharapkan.

## 10. Pengujian dan definisi selesai

Peningkatan dianggap selesai jika:
- Acceptance criteria utama telah dipenuhi.
- Tes relevan berhasil dijalankan.
- Minimal satu seeded fault test membuktikan tes mampu menangkap regresi: tes gagal saat logika sengaja dirusak pada branch/scratch terpisah, lalu perubahan eksperimen dibatalkan.
- Jalur kegagalan yang relevan telah diuji, bukan hanya happy path.
- Migrasi aman untuk data yang sudah ada dan reversible bila migration digunakan.
- Otorisasi dan validasi input ditangani.
- UI memiliki loading, empty, error, partial, long-text, dan responsive states sesuai relevansi.
- Screenshot dan video menggunakan data sintetis.
- PR menjelaskan masalah, solusi, trade-offs, cara menguji, dan keterbatasan yang masih ada.

## 11. Artefak submission

Submission yang diminta dalam brief:
1. Satu PDF dengan narasi tahap demi tahap.
2. Link Pull Request terbuka pada repository target.
3. Product/domain insights, termasuk pengguna dan implikasi UU PDP.
4. Daftar temuan P0–P3 dengan dampak.
5. Trade-off 2–3 opsi dan acceptance criteria.
6. Bukti automated tests dan seeded fault test.
7. Contoh AI-generated code yang salah/berisiko serta cara verifikasi/koreksi.
8. Screenshot workflow, edge cases, error states, dan responsive views.
9. Link video demonstrasi 3–5 menit.

## 12. Risiko dan asumsi yang perlu dicatat

- Brief menyebut tidak ada specs RSpec, tidak ada test runner frontend, dan tidak ada CI. Validasi keadaan repository saat checkout; jangan menganggap keadaan belum berubah.
- Setup lokal dapat terhambat oleh versi runtime, environment variables, layanan database, atau API key. Catat hambatan aktual.
- Tidak semua perilaku yang diinginkan telah dispesifikasikan. Buat asumsi eksplisit dan jelaskan alasannya.
- Deadline di brief tidak menyertakan tahun yang jelas; verifikasi melalui portal.
- Jangan mencatat secret atau personal data dalam laporan.

## 13. Template keputusan fitur

Isi setelah audit:

- **Nama masalah:**
- **Pengguna terdampak:**
- **Workflow/langkah:**
- **Perilaku aktual:**
- **Perilaku ideal:**
- **Bukti/reproduksi:**
- **Severity dan alasan:**
- **Jenis:** missing specification / defective implementation
- **Dampak produk:**
- **Risiko privasi/keamanan:**
- **Solusi yang dipertimbangkan:**
- **Opsi terpilih dan alasan:**
- **Acceptance criteria:**
- **Out of scope:**
- **Cara verifikasi:**
