# Tanggapan atas Feedback Reviewer

Branch perbaikan: `fix/reviewer-feedback`

| # | Feedback | Status |
|---|---|---|
| 1 | Microphone failure (F6) bisa mengakhiri sesi | Selesai, sudah dicoba manual |
| 2 | Rename key F3 belum aman untuk data lama | Selesai, sudah dicoba manual |
| 3 | State Portfolio F4 belum lengkap | Selesai, sudah dicoba manual |
| 4 | Failure conditions pada perbandingan opsi | Selesai, perubahan dokumen saja |
| 5 | AI Verification Moment | Menyusul |

---

## 1. Microphone Failure (F6)

**Commit:** `b1d6d3f`

### Feedback

WebSocket dibuka sebelum akses microphone berhasil diperoleh. Akibatnya, ketika akses microphone gagal, sesi sudah berstatus `active` dan akhirnya dihentikan. Urutannya perlu diubah agar microphone diperoleh lebih dulu.

### Akar masalah

`startInterview` memanggil `connect()` sebelum `startCapture()`. Backend menjalankan `Sessions::StartHandler` begitu socket tersambung, sehingga sesi menjadi `active` meskipun microphone belum tentu tersedia.

Saat mereproduksi, saya menemukan dampak yang lebih parah dari perkiraan saya sebelumnya. Perbaikan F6 yang pertama memang menyetel layar ke pesan error microphone, tetapi penutupan socket lalu menjalankan `onclose`, yang mengganti layar menjadi "Interview Complete". Kandidat melihat interview seolah selesai, padahal belum dimulai dan sesinya sudah berakhir.

Kesalahan ini lolos karena tes F6 saya memakai mock untuk `useAudioWebSocket`, sehingga `onclose` yang asli tidak pernah berjalan.

### Perbaikan

- Urutan `startInterview` menjadi: dapatkan microphone, mute, baru `connect()`.
- `useAudioCapture.start()` mengembalikan `true` atau `false`. Jika `false`, socket tidak dibuka sama sekali.
- Jika setup gagal setelah microphone sempat didapat, microphone dilepas agar tidak tetap menyala.

### Cara reproduce

Saya membandingkan dua project yang berjalan berdampingan: clone versi yang direview (`a250a03`) dan versi perbaikan.

1. Buka link undangan kandidat, izinkan microphone, dan tunggu semua hardware check lolos.
2. Buka DevTools → Network → filter WS.
3. Tempel baris berikut di Console untuk mensimulasikan microphone yang gagal setelah hardware check lolos:

   ```js
   navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
   ```

4. Klik **Start Interview**, lalu periksa layar, tab WS, dan status sesi di database.

### Hasil

| Yang diperiksa | Sebelum | Sesudah |
|---|---|---|
| Layar | "Interview Complete" | "Couldn't access your microphone" dengan tombol "Try again" |
| Koneksi WebSocket | Dibuka | Tidak dibuka |
| Status sesi | `ended` | Tetap `pending` |
| `started_at` | Terisi | `nil` |
| `end_reason` | `error` | `nil` |

Hasil di atas sesuai ekspektasi. Di clone, sesi berakhir sekitar 8 detik setelah dimulai karena clone tidak memakai API key asli, sehingga koneksi ke Gemini gagal lebih dulu. Dengan API key yang valid, kode backend menunjukkan sesi akan dihentikan oleh grace timer 120 detik. Jalur grace timer ini saya telusuri dari kode, tidak saya jalankan.

### Tes otomatis

Dua tes baru ditulis lebih dulu dan gagal pada kode lama:

- `never opens the WebSocket when the microphone cannot be acquired`: `connect` terpanggil satu kali padahal microphone gagal.
- `opens the WebSocket only after the microphone has been acquired`: socket dibuka sebelum `getUserMedia`.

Setelah perbaikan, keenam tes di `InterviewPage.test.tsx` lolos.

### Keterbatasan

- Tes otomatis masih memakai mock untuk `useAudioWebSocket`. Tes ini memeriksa urutan panggilan, tetapi tidak menjalankan `onclose` yang asli. Jalur tersebut hanya terbukti lewat pengujian manual di atas.
- Kegagalan microphone disimulasikan lewat Console, bukan dengan mencabut perangkat.

---

## 2. Rename Key F3 pada Data Lama

**Commit:** `7a45ea6`

### Feedback

Laporan yang sudah tersimpan masih memakai key `expected_level`, sehingga kolom Required kosong dan export PDF rusak. Perlu migrasi data atau fallback saat membaca.

### Akar masalah

Rename key hanya saya lakukan di sisi tulis (`fit_gap/engine.rb`), sedangkan pembaca (`pdf_generator` dan frontend) memakai `required_level`. Akibatnya, data lama tidak terbaca.

### Perbaikan

- Menambahkan `FitGapReport#normalized_skill_comparisons`, yang menerjemahkan `expected_level` menjadi `required_level` saat data dibaca.
- Method ini dipakai oleh `fit_gap_json` (API, yang juga menopang UI dan export JSON) dan oleh PDF.
- Saya memilih fallback dibanding migrasi karena tidak mengubah baris yang ada, sehingga tidak perlu rollback.

### Cara reproduce

Saya membandingkan dua project yang berjalan berdampingan: clone versi yang direview (`a250a03`, web di port 5174) dan versi perbaikan (web di port 5173).

1. Buat laporan berbentuk lama dengan `FitGapReport.create!`, memakai key `expected_level: 4` dan `candidate_level: 3`.
2. Buka halaman Fit/Gap, lalu periksa tabel dan response API.
3. Export PDF, lalu periksa baris skill di dalamnya.

### Hasil

| Yang diperiksa | Sebelum | Sesudah |
|---|---|---|
| Kolom Required | Kosong | L4 |
| Kolom Candidate | L3 | L3 |
| Kolom Result | Gap -1 | Gap -1 |
| Baris PDF | `Ruby on Rails — L3 Gap -1` | `Ruby on Rails L4 L3 Gap -1` |
| Response API | `"expected_level": 4` | `"required_level": 4` |

Hasil di atas sesuai ekspektasi.

### Tes otomatis

Delapan tes baru (6 model, 2 request/PDF) gagal pada kode lama, antara lain dengan `expected: 4, got: nil` dan `expected: "L4", got: "—"`. Setelah perbaikan, kedelapan tes lolos.

### Keterbatasan

- Data lama tetap berbentuk lama di database sampai laporannya dibuat ulang.
- Laporan lama pada reproduksi ini saya buat manual dengan bentuk lama, bukan data produksi.

---

## 3. State Portfolio F4

**Commit:** `0fac686`

### Feedback

Sesi yang masih berjalan tetap menampilkan "AI is analyzing", padahal belum ada yang bisa dianalisis. Sesi `ended` yang tidak punya portfolio melakukan polling tanpa batas.

### Akar masalah

Perbaikan F4 pertama hanya memisahkan sesi yang belum dimulai. Sesi `active` dan `ended` tanpa portfolio masih dijawab sama oleh API, yaitu `202 {"status":"generating"}`, sehingga halaman menampilkan pesan yang sama untuk keduanya. Polling hanya berhenti kalau statusnya berubah, jadi spinner berputar terus jika portfolio tidak pernah muncul.

Saat menyelesaikan perbaikan ini, saya menemukan bug pada perbaikan saya sendiri. `pollTimedOut` hanya di-reset oleh tombol "Check again". Kalau halaman tetap ter-mount saat pindah dari sesi yang sudah timeout ke sesi aktif, panel "Interview is still in progress" dan "Portfolio is taking longer than expected" tampil bersamaan.

### Perbaikan

- API menjawab `200 {"status":"in_progress"}` untuk sesi aktif. Sesi `ended` tanpa portfolio tetap `202 {"status":"generating"}`, karena worker masih mungkin selesai.
- Sesi aktif menampilkan "Interview is still in progress" dengan tombol "Open Live Monitor" dan "Refresh", tanpa polling.
- `usePolling` menerima batas percobaan. Polling portfolio berhenti setelah 60 kali dengan interval 5 detik, lalu menampilkan "Portfolio is taking longer than expected" dengan tombol "Check again".
- `pollTimedOut` di-reset setiap kali sesi berganti.

### Cara reproduce

Saya membandingkan dua project yang berjalan berdampingan: clone versi yang direview (`a250a03`, API di port 3002, web di port 5174) dan versi perbaikan (API di port 3001, web di port 5173).

1. Siapkan satu sesi `active` dan satu sesi `ended` tanpa portfolio. Sebelum: assessment 3, sesi 11 dan 12. Sesudah: assessment 7, sesi 22 dan 23.
2. Panggil `GET /api/v1/sessions/:id/portfolio` untuk kedua sesi, lalu periksa status dan isi response.
3. Buka halaman portfolio sesi aktif, lalu hitung request portfolio.
4. Buka halaman portfolio sesi `ended`, percepat interval 50 kali lewat skrip Console, lalu hitung tick polling.
5. Di versi perbaikan, klik "Check again" setelah timeout.

### Hasil

| Yang diperiksa | Sebelum | Sesudah |
|---|---|---|
| API sesi aktif | `202 {"status":"generating"}` | `200 {"status":"in_progress"}` |
| API sesi `ended` | `202 {"status":"generating"}` | `202 {"status":"generating"}` |
| Halaman sesi aktif | "Generating portfolio...", polling terus | "Interview is still in progress", 0 tick baru dan 1 request portfolio selama 8 detik |
| Polling sesi `ended` (interval dipercepat 50 kali) | 119 tick dalam 12 detik, spinner terus berputar | Berhenti di 61 tick dengan "taking longer than expected" |
| "Check again" | Tidak ada | Polling mulai lagi, lalu berhenti lagi di 61 tick |

Hasil di atas sesuai ekspektasi.

Sebelum commit, saya memuat ulang halaman setelah `pollTimedOut` diperbaiki. Sesi 22 ternyata sudah tidak aktif: log menunjukkan sesi itu diakhiri manual lewat `end_session` (`manual_assessor`) dan portfolio-nya sudah dibuat, sehingga halamannya wajar menampilkan hasil portfolio. Karena itu saya membuat sesi aktif baru di database lokal (sesi 24, assessment 7) untuk pengecekan berikut:

| Yang diperiksa | Hasil |
|---|---|
| Halaman sesi aktif | "Interview is still in progress", 1 request portfolio selama 6 detik |
| Klik "Refresh" | Menambah tepat 1 request, panel tetap sama |
| Klik "Open Live Monitor" | Pindah ke `/assessments/7/sessions/24/monitor` dan halaman Live Monitor tampil |

### Tes otomatis

Tes regresi `drops the timeout message when the page moves to another session while staying mounted` ditulis lebih dulu dan gagal pada kode sebelum reset: "Portfolio is taking longer than expected" masih tampil setelah pindah sesi. Setelah perbaikan, tes ini lolos.

Hasil akhir:

- `PortfolioPage.test.tsx` dan `usePolling.test.ts`: 11 tes lolos.
- `portfolios_show_spec.rb`: 5 tes lolos.

### Keterbatasan

- Batas polling dibuktikan dengan interval yang dipercepat dan fake timer, bukan dengan waktu asli 5 menit.
- Perpindahan antarsesi tanpa remount hanya diuji lewat tes otomatis, tidak di browser.
- "Refresh" hanya dicoba saat sesi masih aktif. Perpindahan tampilan ketika sesi berakhir lalu "Refresh" diklik tidak dicoba.
- Sesi repro dibuat langsung di database lokal, bukan lewat interview sungguhan.

---

## 4. Failure Conditions

**Commit:** `dfde2e2`

### Feedback

Option A tidak punya failure conditions, sedangkan Option B hanya menyinggungnya di bagian maintainability. Kedua opsi perlu failure conditions yang eksplisit.

### Akar masalah

Perbandingan opsi hanya membahas dampak, biaya, dan kecocokan, tanpa menyebut kapan tiap opsi gagal.

Saat mencocokkan draf dengan kode, saya menemukan bagian Keputusan juga terlalu optimistis. AC8 ditulis terpenuhi, padahal `WEB_BASE_URL` yang tidak di-set hanya menghasilkan log warning dan link rusak tetap dibuat. Draf juga menyebut "sesi gagal", padahal tidak ada kode yang menulis status `failed`; sesi error tersimpan sebagai `ended`.

### Perbaikan

Perubahan hanya ada di `assessment/04_revamp_strategy.md`, tanpa perubahan kode.

- Option A kini punya enam kondisi gagal: konfigurasi link, arti status HTTP, server bermasalah saat link dibuka, koneksi putus saat interview, link sesi error dibuka ulang, dan dua tab.
- Option B kini punya kondisi gagal yang ditandai sebagai analisis, karena opsi ini belum diimplementasi.
- Keputusan kini memisahkan status tiap AC: terpenuhi (AC1, AC2), terpenuhi dengan catatan (AC5, AC6), sebagian (AC3, AC8), dan belum (AC4, AC7).
- Deskripsi Option A kini menyebut bahwa microphone diminta sebelum WebSocket dibuka.

### Keterbatasan

- Kondisi gagal Option A diverifikasi dengan membaca kode. Saya tidak menjalankan skenarionya dan tidak menjalankan tes.
- Kondisi gagal Option B adalah analisis desain, belum dibuktikan dengan implementasi.
- Kondisi gagal Option A tetap ada di aplikasi. Poin ini hanya mendokumentasikannya, tidak memperbaikinya.
