# Daftar Temuan Masalah & Inisiatif Peningkatan

Dokumen ini mencatat seluruh temuan saat menguji aplikasi AI Interview Platform dari backend (Rails) hingga frontend (React). 

Sesuai ketentuan, temuan dikelompokkan menjadi:
1. **Temuan Fungsional, Keamanan & Kepatuhan**: Masalah kode yang tergolong **Implementasi Cacat** atau **Spesifikasi Hilang**.
2. **Inisiatif Peningkatan Antarmuka**: Penyempurnaan pengalaman pengguna yang dilakukan secara proaktif berdasarkan asumsi kebutuhan produk B2B.

---

## 1. Tabel Ringkasan

### 1.1 Temuan Masalah & Kepatuhan (Fungsional, Keamanan, Regulasi)

| Nomor ID | Tingkat | Masalah yang Ditemukan | Akibatnya Bagi Pengguna | Jenis Temuan | Bagian | Bukti Lokasi Kode |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KEAMANAN-01** | Kritis (P0) | Pengubahan nilai skill kandidat tidak memeriksa tenant atau organisasi asesor yang sedang login. | Asesor dari Perusahaan A bisa mengubah nilai kandidat Perusahaan B dengan mengganti parameter ID di URL. | **Implementasi Cacat** | Backend | `api/app/controllers/api/v1/portfolio_skills_controller.rb` baris 13 |
| **KEAMANAN-02** | Kritis (P0) | Akses portofolio, analisis lowongan, dan ekspor PDF tidak memvalidasi tenant aktif. | Data portofolio, hasil analisis, dan berkas PDF kandidat dapat diakses dan diunduh oleh organisasi lain. | **Implementasi Cacat** | Backend | `api/app/controllers/api/v1/portfolios_controller.rb` baris 39-53 |
| **DATA-01** | Kritis (P0) | Sistem memanggil `destroy_all` pada skill saat memproses ulang portofolio. | Nilai koreksi manual dan catatan asesor terhapus dari database jika transkrip dianalisis ulang. | **Implementasi Cacat** | Backend | `api/app/services/portfolios/generator.rb` baris 112 |
| **TAMPILAN-01** | Tinggi (P1) | Perbedaan nama atribut antara backend dan frontend (`expected_level` vs `required_level`) serta hilangnya flag `is_override`. | Kolom syarat (*Required*) pada tabel perbandingan Fit/Gap tampil kosong dan penanda pensil koreksi manual tidak muncul. | **Implementasi Cacat** | Backend & Frontend | `web/src/components/fitgap/ComparisonTable.tsx` baris 50-56 & `api/app/services/fit_gap/engine.rb` baris 61-65 |
| **TAMPILAN-02** | Tinggi (P1) | Penanganan error narasi AI pada laporan Fit/Gap belum memiliki mekanisme retry dan langsung beralih ke fallback kaku. | Jika API AI mengalami kendala atau rate limit, narasi budaya dan rekomendasi hilang dan berganti kalimat ringkasan singkat tanpa pemberitahuan ke pengguna. | **Implementasi Cacat** | Backend & Frontend | `api/app/services/fit_gap/engine.rb` baris 105-108 |
| **TAMPILAN-03** | Tinggi (P1) | Form pendaftaran akun baru (*Signup*) di frontend memanggil endpoint yang tidak tersedia di backend. | Pendaftaran mandiri menghasilkan error 404 karena rute tidak ada, sementara sistem menggunakan manajemen akun terpusat oleh administrator. | **Spesifikasi Hilang** | Frontend & Backend | `web/src/pages/auth/SignupPage.tsx` baris 43 & `api/config/routes.rb` |
| **HUKUM-01** | Tinggi (P1) | Belum ada lembar persetujuan perekaman suara sesuai ketentuan UU Perlindungan Data Pribadi (UU PDP). | Suara kandidat direkam dan diproses oleh model AI pihak ketiga tanpa persetujuan eksplisit (UU PDP No. 27/2022 Pasal 20 & 22). | **Spesifikasi Hilang** | Frontend | `web/src/pages/interview/InterviewPage.tsx` |
| **PENGUJIAN-01** | Sedang (P2) | Belum ada pengujian otomatis (*automated test*) di dalam repositori. | Tidak ada verifikasi otomatis untuk memastikan stabilitas kode dan mencegah regresi saat terjadi perbaikan. | **Spesifikasi Hilang** | Backend & Frontend | Direktori `api/spec/` dan konfigurasi `web/package.json` |
| **JARINGAN-01** | Sedang (P2) | Uji kecepatan internet mengandalkan CDN publik tanpa opsi pengujian lokal ke server platform. | Kandidat dapat gagal masuk ruang wawancara jika akses ke CDN luar lambat atau diblokir firewall, meskipun koneksi ke server platform normal. | **Implementasi Cacat** | Backend & Frontend | `web/src/utils/internetSpeedTest.ts` baris 22 & `api/config/routes.rb` |

### 1.2 Inisiatif Peningkatan Antarmuka & Ergonomi (Berdasarkan Asumsi)

> *Catatan: Secara fungsional dasar, antarmuka bawaan sudah berjalan. Peningkatan di bawah ini bukan perbaikan kode rusak, melainkan inisiatif desain untuk meningkatkan kenyamanan dan efisiensi kerja asesor (merujuk ke ASUMSI-11 dan ASUMSI-12 pada `assumptions.md`).*

| Nomor ID | Kategori | Latar Belakang & Asumsi Desain | Bentuk Peningkatan yang Dilakukan | Jenis Temuan | Bagian | Bukti Lokasi Kode |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TAMPILAN-04** | Sistem Desain UI | Asesor membutuhkan antarmuka yang bersih, flat, dan sejajar agar fokus mengevaluasi data kandidat tanpa gangguan visual. | Menyelaraskan padding kartu (p-6), mengunci footer kartu pada grid dengan flex vertikal, meratakan label select menu, dan meniadakan bayangan bertingkat. | **Inisiatif Desain (Peningkatan UX)** | Frontend | `web/src/components/ui/` (`card.tsx`, `button.tsx`, `select.tsx`, dll.) |
| **TAMPILAN-05** | Tata Letak & Alur Kerja | Ruang kerja B2B lebih efisien dengan navigasi sidebar modular, formulir lebar penuh, tabel dengan kolom terkunci, dan adaptasi tablet yang setara mobile. | Mengganti navbar lama dengan sidebar modular (drawer pada breakpoint 1024px), navigasi breadcrumb hierarkis, tabel dengan nomor urut berurutan dan tombol aksi eksplisit, serta formulir lebar penuh bebas garis pemisah. | **Inisiatif Desain (Peningkatan UX)** | Frontend | `web/src/components/layout/`, `web/src/pages/assessments/`, `web/src/pages/vacancies/` |

---

## 2. Rincian Masalah & Inisiatif

### 2.1 Masalah Fungsional, Keamanan & Regulasi

#### KEAMANAN-01: Celah Pengubahan Nilai Kandidat Lintas Organisasi (IDOR)
* **Masalah:** Pada endpoint penyimpanan nilai manual (`PortfolioSkillsController#override`), pencarian data hanya menggunakan ID tanpa memvalidasi kepemilikan tenant (`PortfolioSkill.find(params[:id])`).
* **Letak Kode:** `api/app/controllers/api/v1/portfolio_skills_controller.rb` baris 13.
* **Akibat:** Pengguna dari satu organisasi dapat mengubah nilai kandidat milik organisasi lain dengan mengganti parameter ID pada permintaan API.

#### KEAMANAN-02: Kebocoran Data Hasil Wawancara & Ekspor PDF
* **Masalah:** Pada endpoint tampilan portofolio, analisis lowongan, dan ekspor berkas PDF, pencarian portofolio (`Portfolio.find(params[:id])`) tidak dikunci berdasarkan tenant aktif.
* **Letak Kode:** `api/app/controllers/api/v1/portfolios_controller.rb` baris 39, 44, dan 53.
* **Akibat:** Laporan penilaian, ringkasan wawancara, dan berkas PDF kandidat dapat diakses serta diunduh oleh akun dari organisasi lain.

#### DATA-01: Nilai Koreksi Manual dan Catatan Asesor Terhapus Saat Regenerasi
* **Masalah:** Saat transkrip atau portofolio dianalisis ulang, generator memanggil `portfolio.portfolio_skills.destroy_all`. Karena tabel skill berelasi ke catatan asesor dengan aturan `dependent: :destroy`, seluruh data koreksi manual ikut terhapus.
* **Letak Kode:** `api/app/services/portfolios/generator.rb` baris 112.
* **Akibat:** Jika transkrip diproses ulang (misalnya setelah perbaikan transkrip atau retry), nilai koreksi manual dan catatan pertimbangan yang telah ditulis oleh asesor hilang dari database.

#### TAMPILAN-01: Kolom Syarat Lowongan Kosong & Ikon Koreksi Manual Hilang
* **Masalah:** 
  1. Backend mengirim nilai syarat level dengan nama `expected_level`, sedangkan frontend membacanya dengan nama `required_level`.
  2. Backend tidak menyertakan penanda `is_override: true` pada daftar perbandingan skill.
* **Letak Kode:** `web/src/components/fitgap/ComparisonTable.tsx` baris 50 & 56, serta `api/app/services/fit_gap/engine.rb` baris 61-65.
* **Akibat:** Pada tabel laporan Fit/Gap, kolom syarat (*Required*) tampil kosong tanpa angka, dan skill yang nilainya telah dikoreksi asesor tidak memunculkan ikon pensil.

#### TAMPILAN-02: Narasi AI Berubah Menjadi Ringkasan Kaku Saat Terjadi Gangguan
* **Masalah:** Jika pemanggilan model AI mengalami kendala (seperti rate limit atau timeout), sistem menangkap error secara pasif dan langsung beralih ke ringkasan cadangan tanpa melakukan percobaan ulang (*retry*).
* **Letak Kode:** `api/app/services/fit_gap/engine.rb` baris 105-108.
* **Akibat:** Analisis budaya dan rekomendasi tersembunyi, berganti dengan satu kalimat ringkasan kaku tanpa indikator error yang jelas bagi pengguna.

#### TAMPILAN-03: Form Registrasi Mandiri Menghasilkan Error 404
* **Masalah:** Halaman registrasi frontend (`SignupPage.tsx`) memanggil rute `POST /api/v1/signup`, namun rute tersebut tidak tersedia di backend (`routes.rb`).
* **Letak Kode:** `web/src/pages/auth/SignupPage.tsx` baris 43 dan `api/config/routes.rb`.
* **Akibat:** Form registrasi tidak dapat digunakan dan menghasilkan error 404. Platform ini dirancang untuk enterprise multi-tenant dengan akun yang dikelola terpusat oleh administrator.

#### HUKUM-01: Ketiadaan Lembar Persetujuan Rekaman Biometrik Suara (UU PDP)
* **Masalah:** Sebelum wawancara dimulai, kandidat hanya diarahkan ke pemeriksaan perangkat teknis tanpa lembar persetujuan sadar (*informed consent*) atas perekaman dan pemrosesan audio oleh AI pihak ketiga.
* **Letak Kode:** `web/src/pages/interview/InterviewPage.tsx`.
* **Akibat:** Pelaksanaan wawancara belum memenuhi ketentuan UU Perlindungan Data Pribadi No. 27/2022 Pasal 20 & 22 yang mensyaratkan persetujuan eksplisit untuk pemrosesan data biometrik suara.

#### PENGUJIAN-01: Ketiadaan Pengujian Otomatis (*Test Coverage 0%*)
* **Masalah:** Repositori awal tidak menyertakan berkas pengujian otomatis untuk memvalidasi alur kerja backend maupun frontend.
* **Letak Kode:** Direktori `api/spec/` dan konfigurasi `web/package.json`.
* **Akibat:** Tidak ada mekanisme pengujian otomatis untuk memastikan fungsi berjalan benar dan mencegah kerusakan kode (*regression*) saat dilakukan perubahan.

#### JARINGAN-01: Pengujian Kecepatan Internet Bergantung pada Server Luar
* **Masalah:** Fungsi uji kecepatan internet mengunduh pustaka dari CDN pihak ketiga tanpa opsi pengujian langsung ke server platform. Backend juga belum menyediakan endpoint pengujian unduh.
* **Letak Kode:** `web/src/utils/internetSpeedTest.ts` baris 22 dan `api/config/routes.rb`.
* **Akibat:** Kandidat dapat tertahan di tahap pemeriksaan sistem jika akses ke CDN luar terhambat atau dibatasi oleh jaringan lokal, meskipun koneksi ke server platform berjalan normal.

---

### 2.2 Inisiatif Peningkatan Desain

#### TAMPILAN-04: Penyempurnaan Komponen UI Dasar
* **Latar Belakang & Asumsi:** Kartu bawaan memiliki padding yang tidak seragam (header 24px vs content 16px), footer pada CSS Grid tidak selalu sejajar di dasar kartu ketika panjang teks berbeda, dan tombol memiliki bayangan bertingkat sementara kartu bernuansa flat.
* **Letak Kode:** Komponen di `web/src/components/ui/` (`card.tsx`, `button.tsx`, `select.tsx`, `dropdown-menu.tsx`, dll.).
* **Peningkatan yang Dilakukan:** Menyeragamkan padding ke 24px (`p-6`), menerapkan struktur `flex flex-col` pada Card dan `flex-1` pada CardContent agar footer sejajar di grid, meratakan label pilihan dropdown, dan meniadakan bayangan bertingkat untuk tema flat yang konsisten.

#### TAMPILAN-05: Penataan Ulang Tata Letak, Redesain Formulir & Pengalaman Tablet
* **Latar Belakang & Asumsi:** Asesor membutuhkan ruang kerja vertikal yang leluasa, navigasi halaman hierarkis yang jelas, tabel data yang tidak bergeser saat interaksi, serta kenyamanan akses melalui perangkat tablet di samping desktop dan mobile.
* **Letak Kode:** Direktori `web/src/components/layout/`, `web/src/pages/assessments/`, dan `web/src/pages/vacancies/`.
* **Peningkatan yang Dilakukan:**
  1. Menambahkan logo dan favicon Rakamin pada antarmuka login dan header kandidat.
  2. Mengganti navbar atas dengan sistem sidebar modular yang dapat diciutkan serta drawer otomatis pada tablet dan mobile (breakpoint 1024px).
  3. Menyediakan navigasi breadcrumbs dinamis yang meringkas segmen perantara di layar kecil.
  4. Menstandarisasi tabel daftar asesmen dan lowongan dengan nomor urut berurutan, baris non-klik, dan tombol aksi eksplisit `Open →`.
  5. Merancang ulang formulir asesmen dan lowongan ke lebar penuh (`w-full`), membersihkan garis pemisah yang padat, serta menyusun kartu rubrik level secara horizontal (5 kolom) agar mudah dipindai asesor.

---

## 3. Catatan Kendala Teknis & Sistem Luar

Bagian ini mencatat batasan teknis dari pihak ketiga atau arsitektur platform induk:

1. **KENDALA-AI: Penyesuaian Model Gemini**
   * *Kondisi:* Model yang tercantum di dokumentasi awal (`gemini-2.0-*`) sudah tidak tersedia di API Google (404 Not Found), sementara model Pro memiliki batasan kuota pada akun gratis.
   * *Tindakan:* Mengarahkan konfigurasi ke model aktif `gemini-3.8-flash` yang responsif dan berjalan stabil.
2. **KENDALA-PORT: Konfigurasi Default Tautan Undangan**
   * *Kondisi:* Pengaturan bawaan sistem mengarahkan tautan sesi wawancara kandidat ke port API `:3001` alih-alih port frontend `:5173`.
   * *Tindakan:* Memperbarui konfigurasi `APP_BASE_URL` ke `http://localhost:5173`.
3. **KENDALA-AUTH: Pengelolaan Akun Asesor Terpusat**
   * *Kondisi:* Platform wawancara ini berbagi otentikasi dengan sistem pusat Rakamin melalui token JWT. Form pendaftaran mandiri di frontend adalah sisa kode yang tidak terintegrasi.
   * *Tindakan:* Menghapus form pendaftaran yang tidak terpakai, memperjelas informasi bagi asesor di halaman login untuk menghubungi administrator organisasi, dan menyarankan integrasi Google Workspace SSO pada sistem autentikasi pusat.
