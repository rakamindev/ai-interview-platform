# Step 3: Defining Problem & Gap to Ideal Condition

Cakupan: eksplorasi end-to-end sisi assessor (assessment, skill, vacancy, invite) + Live Monitor/Portfolio/Fit-Gap/Transcript, plus pembacaan kode alur kandidat (`InterviewPage.tsx` + hooks audio). Interview AI real-time tidak diuji end-to-end lokal (`GEMINI_API_KEY` dummy) — dicatat sebagai constraint signal, bukan temuan produk.

Setiap temuan: severity, impact, **missing spec** (belum pernah didefinisikan) vs **defective implementation** (didefinisikan tapi salah), lokasi kode.

---

## P0 — Kritis, memblokir alur inti

### F1. Link undangan kandidat mengarah ke port backend, bukan frontend
**Impact:** setiap kandidat yang diundang hari ini dapat link yang 404. Alur paling penting produk ini — "kandidat mengikuti interview" — tidak bisa terjadi di konfigurasi default.
**Tipe:** defective implementation + missing spec (tidak ada `WEB_BASE_URL`/`FRONTEND_BASE_URL` sama sekali).
**Lokasi:** [`api/app/models/session.rb:29-30`](../api/app/models/session.rb) — `invite_url` pakai `APP_BASE_URL` (port API, 3001), padahal route `/interview/:token` cuma ada di React SPA (port 5173 saat dev).

### F2. Kegagalan apa pun saat load info kandidat → layar "Interview Complete" palsu
**Impact:** menggabungkan F1 jadi lebih buruk. Link rusak/expired/gagal jaringan sesaat → kandidat lihat "✅ Interview Complete", bukan error. Recruiter tidak dapat sinyal kandidat sebenarnya belum pernah interview, kandidat tidak tahu ada yang salah.
**Tipe:** defective implementation.
**Lokasi:** [`web/src/pages/interview/InterviewPage.tsx:43-52`](../web/src/pages/interview/InterviewPage.tsx) — `.catch(() => setInterviewState("complete"))` meleburkan semua jenis error jadi state sukses terminal. Backend sebenarnya sudah benar (404 spesifik di [`sessions_controller.rb:132-136`](../api/app/controllers/api/v1/sessions_controller.rb)) — frontend yang tidak punya state `"invalid_link"`/`"error"`.

---

## P1 — Merusak nilai inti fitur, dampak lebih sempit

### F3. Kolom "Required" di Fit/Gap Report selalu kosong
**Impact:** fitur andalan produk ini — perbandingan kandidat vs requirement — kolom "Required"-nya kosong untuk setiap skill, setiap report, setiap tenant.
**Tipe:** defective implementation (contract drift, nol shared schema/test).
**Lokasi:** backend simpan key `expected_level` ([`fit_gap/engine.rb:63`](../api/app/services/fit_gap/engine.rb)), frontend baca key `required_level` ([`types/index.ts:132`](../web/src/types/index.ts)) — tidak pernah cocok.

### F4. Portfolio menampilkan "AI is analyzing... ~2 minutes" untuk sesi yang belum pernah dimulai
**Impact:** assessor buka portfolio kandidat yang belum pernah interview → lihat spinner + estimasi waktu, selamanya. Tidak ada beda "sedang diproses" vs "tidak pernah dipicu".
**Tipe:** defective implementation.
**Lokasi:** [`portfolios_controller.rb:13-14`](../api/app/controllers/api/v1/portfolios_controller.rb) — `@portfolio.nil?` dan `@portfolio.generating?` disamakan jadi satu response.

---

## P2 — Feedback menyesatkan, dampak sempit, mudah diperbaiki

### F5. Live Monitor tampilkan badge "● Live" walau sesi belum dimulai
**Impact:** kontradiksi visual langsung ("Live" berdampingan "Waiting for interview to begin..."). Mengikis kepercayaan pada produk yang nilai jualnya "percayai apa yang diamati AI."
**Tipe:** defective implementation — badge tidak dikondisikan pada `session.status === "active"`.
**Lokasi:** `web/src/pages/monitor/LiveMonitorPage.tsx`.

### F6. Tidak ada error handling jika mikrofon gagal tepat saat interview dimulai
**Impact:** `HardwareCheck` sudah probe mic di awal, tapi kalau mic direbut/dicabut aksesnya *setelah* itu lolos dan *sebelum* klik "Start Interview", kandidat terjebak di "Connecting..." tanpa batas waktu tanpa jalan keluar.
**Tipe:** defective implementation (extension point `onError` sudah ada di hook, tidak pernah disambungkan).
**Lokasi:** [`useAudioCapture.ts:43-47`](../web/src/hooks/useAudioCapture.ts) vs [`InterviewPage.tsx:143-145`](../web/src/pages/interview/InterviewPage.tsx).

---

## Constraint Signal (eskalasi ke Technical Lead)

1. **Nol test harness** sebelum sesi ini — semua temuan di atas dikonfirmasi manual (curl, browser, Rails console), bukan lewat test yang gagal.
2. **`GEMINI_API_KEY` placeholder** — jalur audio live tidak diverifikasi end-to-end di lingkungan ini, harus divalidasi dengan key asli sebelum merge apa pun yang menyentuhnya.
3. **`APP_BASE_URL` overload secara arsitektur** — satu variabel untuk dua makna ("di mana API hidup" vs "di mana manusia buka link"). Perbaikan F1 butuh keputusan deployment eksplisit, bukan cuma tambal env var.
4. **Tidak ada contract layer** antara JSONB Rails dan tipe TypeScript (lihat F3) — kelas bug ini akan berulang di response API berbasis JSONB lain (`evidence`, coverage map) tanpa shared schema/contract test.
