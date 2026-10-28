# Rencana awal: status wawancara dan hasil yang dapat dipercaya

> Acuan scope implementasi submission terbaru: [scope-final.md](scope-final.md). Dokumen plan.md dipertahankan sebagai usulan lifecycle historis/backlog; bukan cakupan perubahan yang sudah diimplementasikan.

> Update prioritas: pengguna meminta audio diselesaikan terlebih dahulu. Perubahan audio dan bukti pengujiannya dicatat pada `audio-fix.md`. Rencana lifecycle di bawah tetap merupakan usulan lanjutan, bukan klaim sudah diimplementasikan.

**Status:** usulan scope dan acceptance criteria, 27 Oktober 2026. Belum diimplementasikan dan belum merupakan bukti pekerjaan selesai. Rencana ini melanjutkan `findings.md` F01/F03/F04. Detail pemulihan job perlu dikonfirmasi melalui tes sebelum implementasi final.

**Goal:** kandidat dan assessor dapat membedakan sesi gagal, sesi berakhir, hasil sedang diproses, hasil gagal, dan hasil siap; tindakan pemulihan tidak menghasilkan pekerjaan duplikat.

**Architecture:** pertahankan status database yang sudah ada, tambahkan kontrak status yang konsisten pada API, dan gunakan kontrak itu pada halaman kandidat serta assessor. Perbaiki transisi retry dan penyimpanan hasil di service/worker yang sudah ada. Dahulukan perubahan tanpa migrasi; tambahkan migrasi hanya jika kebutuhan concurrency tidak dapat dijamin dengan struktur yang ada.

**Tech stack:** Rails 7, PostgreSQL, Redis/Sidekiq, React 18, TypeScript, Jotai, komponen UI yang sudah tersedia. RSpec untuk backend; test runner frontend belum tersedia dan perlu dipilih yang kompatibel dengan toolchain repository.

**Spec:** `findings.md`, brief studi kasus, PRD 01, dan PRD 02. Dokumen ini adalah rencana awal yang dapat ditinjau, bukan keputusan bahwa seluruh temuan masuk implementasi.

## 1. Masalah dan nilai produk

Sesi dapat berakhir karena error, tetapi kandidat melihat pesan sukses. Sesi lain berakhir normal, sementara portfolio gagal diproses. Daftar assessor hanya memberi label akhir sesi tanpa menunjukkan kesiapan hasil. Kandidat dapat mengira evaluasinya selesai; assessor harus membuka hasil satu per satu untuk mengetahui apa yang terjadi.

Perubahan ini membantu recruiter membedakan pekerjaan yang siap direview dari yang memerlukan tindakan, serta mencegah kegagalan teknis dipersepsikan sebagai hasil penilaian kandidat. Keberhasilan diukur dari perilaku yang dapat diuji dan ditelusuri, bukan jumlah baris kode atau klaim peningkatan konversi yang belum diukur.

## 2. Batas scope

### Masuk scope utama

- Status akhir kandidat membedakan gagal, selesai normal, dan gagal memuat data.
- API assessor menyediakan hasil proses sesi dan status portfolio secara terpisah.
- Daftar sesi dan halaman portfolio menampilkan loading, queued/generating, failed, ready, missing, serta error request.
- Retry portfolio memiliki state pending, pencegahan permintaan duplikat, dan kegagalan yang dapat dipahami.
- Ekspor hanya tersedia saat portfolio complete; bukti parsial dinyatakan jelas.
- Tes regresi backend/frontend, termasuk input buruk, otorisasi, timeout/model error, dan klik ulang.

### Backlog di luar perubahan utama

- Perombakan transport audio, model probing, threshold internet, dan engine fit/gap.
- Perbaikan Retry hardware sebagai bonus terpisah setelah scope utama terverifikasi.
- Audit keamanan menyeluruh, dashboard baru, dan migrasi seluruh arsitektur antrean.

Masalah yang ditunda tetap dicatat sebagai risiko. Perubahan status tidak dianggap memperbaiki kualitas audio atau akurasi penilaian.

## 3. Pilihan dan trade-off

| Opsi | Nilai dan biaya | Maintainability / batas kegagalan | Keputusan awal |
| --- | --- | --- | --- |
| A. Ubah copy dan kondisi render frontend saja | Cepat memperjelas layar; backend tetap ambigu | Frontend harus menebak alasan akhir dan status job; tidak melindungi retry/penulisan data | Tidak cukup untuk scope fullstack |
| B. Kontrak API yang eksplisit, perbaikan service/worker terarah, dan UI sesuai state | Menyelesaikan kebingungan pada sumber data serta layar; biaya sedang | Memakai model dan komponen existing; perlu tes retry/concurrency dan record lama | Usulan pilihan karena paling dekat dengan gap teramati |
| C. Lifecycle baru dengan event/outbox serta antrean terpisah | Menangani delivery/recovery lebih luas | Perubahan dan migrasi lebih besar; biaya operasional dan pembuktian melebihi kebutuhan awal | Ditunda; dapat dipertimbangkan bila reliabilitas enqueue tidak cukup dengan pendekatan B |

Opsi B adalah rekomendasi penyusun dokumen, bukan klaim sudah dipilih melalui riset pengguna. Risiko enqueue setelah commit tetap perlu dianalisis; jangan menjanjikan exactly-once processing tanpa mekanisme dan bukti.

## 4. Kontrak perilaku yang diusulkan

Gunakan `status`, `end_reason`, dan `generation_status` yang sudah ada sebagai data dasar. Tambahkan field turunan tanpa mengganti arti field lama:

- `session_outcome`: `pending`, `in_progress`, `ended`, atau `failed`.
- `portfolio_status`: `not_created`, `pending`, `generating`, `complete`, atau `failed`.

Mapping: `status=failed` atau `end_reason=error` menghasilkan outcome failed; status pending/active dipetakan sesuai artinya; ended dengan alasan normal menjadi ended. Nilai unknown/null harus ditampilkan aman sebagai status belum dapat dipastikan, bukan sukses. Backend perlu menghindari end_reason error terhapus oleh event manual yang datang terlambat tanpa dasar pemulihan yang sah.

`session_outcome=ended` hanya menyatakan sesi berakhir. Itu bukan bukti semua skill covered, bukti kandidat cukup, atau portfolio complete. Status portfolio tetap berdiri sendiri, termasuk bila ada bukti parsial dari sesi gagal.

Untuk kandidat, `candidate_info` dan event akhir WebSocket perlu membawa outcome/alasan yang aman. Jangan mengirim detail internal provider, API key, atau stack trace. HTTP error ketika memuat undangan harus memiliki state sendiri, bukan state complete.

### Matriks tampilan

| Kondisi data | Kandidat | Assessor / portfolio |
| --- | --- | --- |
| Pending | Informasi dan kesiapan perangkat | Menunggu kandidat |
| Active | Wawancara berlangsung / reconnect sesuai kondisi | Sesi aktif |
| Ended, alasan error | Wawancara terhenti; arahan menghubungi assessor | Sesi gagal; kesiapan hasil ditampilkan terpisah |
| Ended normal, portfolio pending | Sesi telah berakhir tanpa janji seluruh hasil lengkap | Hasil dalam antrean |
| Portfolio generating | Tidak membuka detail penilaian assessor ke kandidat | Sedang diproses; cegah retry manual ganda |
| Portfolio failed | Tidak mengganti status sesi menjadi sukses/gagal secara keliru | Hasil gagal; aksi coba lagi bagi assessor yang berwenang |
| Portfolio complete | Tidak menyiratkan kandidat lulus seleksi | Hasil siap; ekspor tersedia; tetap tampilkan keterbatasan bukti |
| Portfolio belum ada | Tidak mengarang status proses | Hasil belum tersedia; jangan spinner tanpa dasar bahwa job berjalan |
| Request gagal / nilai tidak dikenal | Pesan gagal memuat; aksi coba muat ulang | Error request terpisah dari job gagal |

## 5. Acceptance criteria

| ID | Input / kondisi | Perilaku yang harus terbukti |
| --- | --- | --- |
| AC01 | Sesi berakhir `reason=error` | Kandidat melihat kegagalan, bukan `Interview Complete` atau klaim semua rekaman berhasil |
| AC02 | Candidate info 404, network error, atau timeout | State error dan aksi pemulihan; tidak dirender sebagai selesai |
| AC03 | Manual end sebelum seluruh coverage selesai | Sesi dapat ended; UI tidak menyebut seluruh skill sudah dinilai |
| AC04 | Portfolio missing/pending/generating/failed/complete | API dan UI membedakan kelima kondisi, termasuk record lama |
| AC05 | Assessor melihat daftar sesi | Outcome sesi dan kesiapan hasil terlihat terpisah; failed session yang punya portfolio tetap ditampilkan jujur |
| AC06 | Retry pada portfolio failed | Satu transisi pending yang sah dan satu pekerjaan logis; UI disabled saat request berjalan |
| AC07 | Dua retry hampir bersamaan / Sidekiq redelivery | Tidak ada penghapusan/penulisan hasil yang saling menimpa atau pemanggilan provider duplikat tanpa guard; tes concurrency membuktikan batasnya |
| AC08 | Enqueue Redis gagal | Tidak ada respons yang mengklaim queued tanpa pekerjaan; state gagal/recoverable dan respons terkontrol |
| AC09 | Provider timeout, 400/404/429, atau JSON tidak valid | Tidak ada false success; detail aman untuk UI; error tersanitasi dan kebijakan retry terukur |
| AC10 | Penulisan skill gagal di tengah | Tidak ada portfolio complete dengan sebagian hasil baru; transaksi menjaga konsistensi |
| AC11 | Transcript kosong, kandidat tidak berbicara, rating null/di luar L1-L5 | Tidak mengarang rating atau mengganti missing menjadi L1; tampilkan ketidakcukupan bukti atau kegagalan validasi yang aman |
| AC12 | Akses tanpa izin / tenant lain / ID tidak ada | Tidak membocorkan sesi atau hasil; autentikasi dan scoping existing tetap diperiksa |
| AC13 | Portfolio belum complete | PDF/JSON dan aksi fit/gap tidak aktif; backend tetap menolak akses langsung |
| AC14 | Refresh kandidat setelah sesi gagal | Tetap tampil gagal berdasarkan data API, bukan sukses akibat reload |
| AC15 | Error panjang, nama panjang, viewport kecil | Copy dapat dibaca, layout tidak melebar, tombol keyboard-accessible, perubahan status diumumkan secara aksesibel |

Aturan untuk bukti tidak cukup tidak boleh menilai kandidat rendah karena kegagalan teknis. Jika kebutuhan itu memerlukan perubahan model data yang melampaui scope, keputusan penyempitan harus dicatat sebelum coding; jangan diam-diam menghapus acceptance criteria.

## 6. Peta file dan tanggung jawab

Path berikut relatif terhadap root repository; daftar ini merupakan target rencana, bukan daftar perubahan yang sudah dilakukan.

| File existing | Tanggung jawab perubahan |
| --- | --- |
| `api/app/models/session.rb` | Method turunan `session_outcome` berdasarkan status dan alasan akhir |
| `api/app/services/sessions/end_handler.rb` | Mempertahankan penyebab akhir yang benar saat panggilan berulang |
| `api/app/controllers/api/v1/sessions_controller.rb` | Mengirim outcome dan status portfolio; response kandidat aman; preload association untuk daftar |
| `api/app/channels/audio_websocket_middleware.rb` | Propagasi outcome pada event akhir tanpa mengubah algoritme audio |
| `api/app/controllers/api/v1/portfolios_controller.rb` | Status missing/queued/failed yang eksplisit, guard retry dan kegagalan enqueue |
| `api/app/services/portfolios/generator.rb` | Validasi keluaran, transaksi penulisan, dan guard pemrosesan ulang |
| `api/app/workers/portfolio_generator_worker.rb` | Kebijakan retry/exhausted yang konsisten dengan kepemilikan attempt |
| `web/src/types/index.ts` | Tipe outcome dan status hasil, termasuk nilai gagal yang sudah didukung backend |
| `web/src/hooks/useAudioWebSocket.ts` | Membedakan akhir normal, error, dan reconnect |
| `web/src/pages/interview/InterviewPage.tsx` | Layar akhir/error dan refresh sesuai outcome |
| `web/src/pages/assessments/AssessmentInvitePage.tsx` | Dua status pada daftar sesi |
| `web/src/pages/portfolio/PortfolioPage.tsx` | State hasil, request error, retry loading/error, dan gating ekspor |
| `web/src/services/sessions.ts` | Tipe kontrak respons bila diperlukan |

Gunakan komponen UI existing dan skill frontend-design saat implementasi UI. Jangan menambah abstraksi global jika helper/model existing cukup. Migrations hanya dibuat bila diperlukan dan harus reversible serta aman untuk record existing.

## 7. Urutan implementasi dan pembuktian

### Task 1 - Regression test dan kontrak status backend

- [ ] Inisialisasi RSpec melalui generator project; arahkan ke database test terpisah dan gunakan data fiktif.
- [ ] Buat `api/spec/models/session_spec.rb`: error outcome failed, ended normal outcome ended, pending/active sesuai data.
- [ ] Buat `api/spec/requests/api/v1/sessions_spec.rb`: candidate failed setelah reload, token invalid, status portfolio terpisah, dan scoping assessor/tenant.
- [ ] Jalankan spec baru pada baseline dan rekam assertion yang gagal karena bug, bukan karena setup test rusak.
- [ ] Implementasikan kontrak additive dan propagasi status; jangan menghapus field existing yang dipakai frontend.
- [ ] Jalankan ulang spec yang relevan dan rekam hasil sebelum commit.

### Task 2 - Lifecycle portfolio dan retry backend

- [ ] Buat `api/spec/requests/api/v1/portfolios_spec.rb` untuk missing, pending, generating, failed, complete, akses ilegal, ekspor prematur, dan retry konflik.
- [ ] Buat `api/spec/services/portfolios/generator_spec.rb` memakai `gemini_client` fake yang sudah didukung konstruktor existing.
- [ ] Tambahkan `api/spec/workers/portfolio_generator_worker_spec.rb` untuk retry/exhaustion dan stale attempt.
- [ ] Tulis skenario error provider, JSON invalid, rating missing, transaksi gagal di tengah, dan Redis enqueue gagal.
- [ ] Jalankan dan lihat tes gagal, lalu implementasikan guard atomik pada state yang sudah ada; hindari memegang lock database sepanjang panggilan HTTP model.
- [ ] Uji dua pemanggilan konkuren dengan koneksi database terpisah. Jika attempt ownership memerlukan field tambahan, buat migrasi terarah serta rollback spec sebelum melanjutkan.
- [ ] Verifikasi pemulihan tidak menggandakan hasil atau menimpa hasil yang sudah complete, lalu commit.

### Task 3 - UI kandidat dan assessor

- [ ] Pasang test runner frontend yang sesuai Vite/React beserta DOM testing minimum; tambahkan script `npm test`.
- [ ] Buat test halaman kandidat untuk AC01, AC02, AC03, dan AC14, dengan API/WebSocket mock.
- [ ] Buat test daftar sesi untuk kombinasi outcome sesi dan portfolio status.
- [ ] Buat test portfolio untuk lima state, request error, retry double-click, retry gagal, dan ekspor belum tersedia.
- [ ] Jalankan tes pada baseline dan simpan assertion yang gagal.
- [ ] Implementasikan state/copy UI sesuai kontrak backend; gunakan komponen existing dan label yang menjelaskan tindakan pengguna.
- [ ] Verifikasi keyboard, screen kecil, teks panjang, serta status yang tidak bergantung pada warna; jalankan tes dan `npm run build`, lalu commit.

### Task 4 - Verifikasi integrasi dan seeded fault

- [ ] Uji deterministic flow memakai fake provider: failed session, ended partial, job timeout, hasil lengkap, dan retry yang berhasil.
- [ ] Lakukan satu live smoke test dengan konfigurasi model milik pengguna bila akses/kuota memungkinkan; bedakan hasil live dari hasil mock.
- [ ] Ambil screenshot sebelum/sesudah untuk kandidat dan assessor pada desktop serta mobile, menggunakan nama fiktif.
- [ ] Buat scratch branch dari perubahan teruji; sengaja rusakkan satu mapping failed menjadi sukses, jalankan regression test hingga gagal, commit bukti fault, pulihkan, lalu tunjukkan tes lulus. Jangan bawa fault ke branch submission.
- [ ] Catat satu AI verification moment yang nyata beserta bukti pemeriksaan/koreksinya. Kandidat awal: instruksi `APP_BASE_URL` yang salah atau kesimpulan terlalu cepat tentang koneksi, jika dibuktikan ulang dengan source dan uji.
- [ ] Rekam perintah, exit code, dan hasil pada dokumen evidence. Tidak ada checkbox dianggap selesai tanpa output.

### Task 5 - Laporan dan submission

- [ ] Lengkapi riset produk/domain Indonesia dan sumber UU PDP; tandai asumsi serta batas riset.
- [ ] Perbarui findings menjadi fixed/open/deferred berdasarkan hasil nyata, sertakan alasan prioritas dan keputusan opsi.
- [ ] Pastikan diff tidak memuat secret, token, data kandidat nyata, atau fault sementara.
- [ ] Buat PR terbuka ke repository tujuan brief; sertakan hasil verifikasi dan keterbatasan.
- [ ] Susun satu PDF dengan narasi Steps 1-5, acceptance criteria, opsi, screenshot, seeded fault, AI verification moment, dan link PR.
- [ ] Rekam video 3-5 menit yang menunjukkan masalah, alur baru, dan bukti pemulihan; verifikasi akses tautan.
- [ ] Periksa PDF dan semua link sebelum upload; sisakan waktu buffer submission.

## 8. Review focus

1. Record lama dengan status ended dan end_reason error harus dibaca benar tanpa migrasi destruktif: Task 1.
2. Event manual/WS yang terlambat tidak boleh menghapus alasan error: Task 1 dan tes hook kandidat di Task 3.
3. Job retry otomatis dan retry manual bisa berlomba: Task 2, termasuk hasil complete yang datang dari attempt berbeda.
4. Redis mati setelah database berubah harus menghasilkan state yang dapat dipulihkan: Task 2.
5. Model mengembalikan teks panjang, rating null, atau payload invalid tidak boleh menghasilkan nilai palsu atau UI rusak: Tasks 2-3.

## 9. Kondisi selesai dan batas klaim

Selesai berarti kontrak status teruji pada API dan UI, jalur pemulihan terbukti, data konsisten, serta evidence dan deliverable tersedia. Jumlah tes hijau tidak menggantikan bukti test pernah gagal pada fault yang relevan. Keberhasilan mock tidak diklaim sebagai kualitas wawancara Gemini atau akurasi penilaian kandidat.

Dokumen ini belum mencatat hasil implementasi, automated test, seeded fault, PR, atau portfolio sukses. Setelah scope disepakati, jalankan tugas bertahap dan perbarui checkbox menggunakan bukti nyata.
