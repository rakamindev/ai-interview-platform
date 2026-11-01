# Step 4: Revamp Strategy, Acceptance Criteria & Trade-offs

## Keputusan Scope

F1 + F2 (keduanya P0) adalah **satu user journey rusak**: *"kandidat buka link → bisa interview, ATAU diberi tahu jelas kenapa tidak bisa."* Hari ini tidak satu pun terjadi. Ini titik leverage tertinggi — pintu masuk seluruh produk; fitur lain (Live Monitor, Portfolio, Fit/Gap) baru relevan setelah sesi benar-benar dimulai.

F3 & F4 adalah perbaikan mekanis independen, dibahas singkat di akhir dokumen ini.

**Target revamp: Candidate Invite & Session-Entry Reliability** — backend (`Session#invite_url`, `candidate_info`) + frontend (state pra-interview `InterviewPage`, saat ini cuma `idle`/`complete` jadi tempat pelarian semua kasus).

---

## Acceptance Criteria

| # | Kondisi | Perilaku yang seharusnya |
|---|---|---|
| AC1 | Token valid, sesi `pending`, pertama dibuka | Hardware check → interview mulai normal |
| AC2 | Token tidak ada/salah format | "Link interview ini tidak valid" — **tidak boleh** layar completion |
| AC3 | Sesi sudah `ended` | Layar berbeda "Anda sudah menyelesaikan interview ini" — bukan state generik yang sama dengan AC2/AC4 |
| AC4 | Sesi `failed` | "Ada masalah pada percobaan sebelumnya — hubungi recruiter" — bukan jalan buntu diam-diam |
| AC5 | Gagal jaringan sementara | "Gagal terhubung — Coba lagi", retry otomatis 2x dulu sebelum tampil UI retry |
| AC6 | Assessment di balik sesi sudah dihapus | Sama seperti AC2 — 404, bukan 500 |
| AC7 | Dua tab/browser dibuka bersamaan | Read-only idempotent di kedua tab; hanya satu boleh pegang lock WebSocket. **Di luar scope iterasi ini** — lihat Option B |
| AC8 | `WEB_BASE_URL` belum dikonfigurasi | Backend gagal jelas / log warning, bukan diam-diam keluarkan link yang 404 |

---

## Option A — Perbaikan Terarah (Direkomendasikan)

Perbaiki `invite_url` → frontend; ganti `.catch(() => complete)` dengan state eksplisit (`invalid_link`, `connection_error`) yang 1:1 memetakan apa yang backend sudah bisa beritahukan. Tanpa perubahan schema. Sekalian perbaiki F6 (file & tema sama): sambungkan `onError` yang hilang dan minta microphone sebelum WebSocket dibuka, supaya kegagalan microphone tidak menyisakan sesi `active`.

- **Product impact vs cost:** rasio tertinggi — memperbaiki journey #1 paling rusak untuk ~90% kasus nyata, ±1 hari kerja.
- **Maintainability:** risiko rendah — tidak ada tabel/job baru, perubahan terlokalisasi.
- **Belum tercakup:** pembukaan ganda (AC7), assessor masih tidak tahu *kenapa* sesi macet di `pending`.
- **Contextual fit:** kuat untuk deadline case study ini, tidak terhambat desain locking yang butuh review sendiri.
- **Kondisi gagal (Option A akan gagal jika):**
  - **Konfigurasi link.** Tanpa `WEB_BASE_URL`, link mengarah ke host API dan berujung 404 karena API tidak punya route `/interview/:token`. Warning hanya masuk log dan link tetap dibuat. `api/k8s/configmap.yaml` belum memuat variabel ini. Nilai kosong atau salah lolos tanpa warning.
  - **Arti status HTTP.** `invalid_link` hanya melihat status 404, jadi 404 dari API atau proxy (route salah, deploy setengah jalan) membuat link valid dianggap tidak valid. 401/403 membuat interceptor axios mengarahkan kandidat ke `/login`.
  - **Server bermasalah saat link dibuka.** Dua retry otomatis berjalan tanpa jeda, jadi gangguan beberapa detik langsung berujung `connection_error`. Axios juga tidak punya timeout: request yang menggantung tidak sampai ke `connection_error`, kandidat tetap di halaman awal, dan tombol mulai tidak berbuat apa-apa karena `sessionId` masih kosong.
  - **Koneksi putus saat interview.** Setelah 3x reconnect browser habis, atau reconnect server ke Gemini gagal, kandidat melihat "Interview Complete" padahal interview belum selesai.
  - **Link sesi error dibuka ulang.** Tidak ada kode yang menulis status `failed`; sesi error tersimpan sebagai `ended`, sehingga kandidat melihat "Interview Complete". Status `failed` dari data lama tidak ditolak, dan WebSocket mengaktifkannya lagi lewat `StartHandler`.
  - **Dua tab (AC7).** Tanpa lock, dua tab bisa membuka dua koneksi audio ke sesi yang sama.

## Option B — Perbaikan Struktural

Semua isi Option A + `first_opened_at`/link-open telemetry yang terlihat assessor + session locking untuk pembukaan bersamaan (AC7 penuh).

- **Product impact vs cost:** nilai jauh lebih tinggi, tapi biaya 2–3x Option A — migrasi baru, locking logic yang harus diuji di bawah konkurensi.
- **Maintainability:** locking adalah liability jangka panjang (stale lock, worker crash mid-session butuh unlock manual).
- **Contextual fit:** tepat untuk skala multi-tenant ke depan, tapi terlalu besar untuk dikerjakan bersamaan dengan membangun test harness dari nol dalam satu iterasi yang sama.
- **Kondisi gagal (analisis, Option B belum diimplementasi):**
  - **Lock tidak terlepas setelah crash.** Kandidat terkunci dari sesinya sendiri sampai TTL habis atau ada unlock manual.
  - **TTL bentrok dengan masa tunggu reconnect.** Backend menjaga koneksi Gemini 120 detik setelah browser putus. TTL yang lebih pendek membiarkan tab lain mengambil lock selama masa itu; TTL yang lebih panjang bisa menolak kandidat yang sedang reconnect kecuali lock mengenali pemegangnya.
  - **Race dan Redis down.** Cek lalu tulis yang tidak atomik membuat dua tab sama-sama lolos, jadi perlu operasi atomik (mis. Redis `SET NX`). Saat Redis down harus diputuskan: fail-open (koneksi ganda lolos) atau fail-closed (kandidat tidak bisa mulai).
  - **Pemindai link.** Pemindai yang menjalankan JavaScript mengisi `first_opened_at`, sehingga assessor melihat link sudah dibuka padahal kandidat belum.
  - **Deploy tidak sinkron.** Jika API dan frontend tidak terdeploy bersamaan, assessor bisa melihat status yang keliru.
  - **Warisan Option A.** Kondisi gagal Option A selain AC7 tetap berlaku.

## Keputusan: **Option A**

Option A cukup kecil untuk diselesaikan dengan test coverage sungguhan dalam timeline ini. Status acceptance criteria:

- **Terpenuhi:** AC1, AC2.
- **Terpenuhi dengan catatan:** AC5 (axios tidak punya timeout, jadi request menggantung tidak sampai ke `connection_error`) dan AC6 (`candidate_info` memang menjawab 404, tetapi belum ada spec khusus, dan assessment yang masih punya sesi tidak bisa dihapus lewat aplikasi).
- **Sebagian:** AC3 (sesi `ended` memakai layar "Interview Complete" yang sama) dan AC8 (hanya ada log warning, link rusak tetap dibuat).
- **Belum:** AC4 (tidak ada layar khusus, dan tidak ada kode yang menulis status `failed`) dan AC7 (pembukaan ganda).

Gap ini sengaja ditunda dan dicatat di sini. **Constraint signal ke Technical Lead:** desain lock untuk akses sesi konkuren adalah pekerjaan masa depan yang nyata, bukan sesuatu yang bisa diimprovisasi di iterasi ini.

## F3 / F4 — Perbaikan Mekanis

- **F3:** rename key `expected_level` → `required_level` di `fit_gap/engine.rb` (frontend sudah "benar" secara kosakata produk). Tambah request spec yang mematok bentuk response. *Tambahan setelah feedback reviewer:* report yang sudah tersimpan masih memakai key lama, jadi pembacaan (API + PDF) lewat `FitGapReport#normalized_skill_comparisons` yang menerjemahkan keduanya saat dibaca. Dipilih fallback baca, bukan migrasi data: tidak mengubah baris yang sudah ada, jadi tidak ada yang perlu di-rollback.
- **F4:** pisahkan cabang `nil` vs `generating?` di `PortfoliosController#show` jadi `not_started` vs `generating`, dengan empty state frontend yang sesuai. *Tambahan setelah feedback reviewer:* sesi yang masih berjalan kini berstatus `in_progress` (bukan `generating`), dan polling Portfolio dibatasi (60 percobaan × 5 detik) lalu berhenti dengan tombol "Check again" — sesi `ended` yang portfolio-nya tidak pernah muncul tidak lagi berputar selamanya.
