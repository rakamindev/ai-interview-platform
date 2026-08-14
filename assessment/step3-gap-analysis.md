# Step 3 — Problem & Gap Analysis (P0–P3)

Semua temuan **terverifikasi** via runtime (curl API), DB inspection, code review, atau kombinasi.

---

## Core Problem (satu kalimat)

**AI-interview-platform menilai kandidat dengan sistem yang (1) tidak melindungi data pribadi kandidat sesuai UU PDP, (2) memiliki model keamanan multi-tenancy yang bisa ditembus dengan kredensial admin biasa, dan (3) memproduksi laporan penilaian yang bisa salah karena seam data (label skill, kontrak API) — padahal salah hasil = mengubah hidup orang.**

Gap ke kondisi ideal: produk belum layak dipercaya sebagai alat penilaian karyawan di Indonesia karena kepatuhan hukum & keakuratan data-nya tidak terjamin.

---

## Severity Ranking

### P0 — Kebocoran data lintas tenant (keamanan & hukum)

**F-01 | Cross-tenant data access via `X-Tenant-Scheme` header** [DEFECTIVE]
- Bukti: `admin@test.com` (milik test-corp) login + header `X-Tenant-Scheme: victim-corp` → token ber-scheme `victim-corp` → bisa lihat assessment rahasia tenant lain.
- Akar: `User` tak terikat tenant (`user.rb`), `resolve_scheme` percaya header (`authentication_controller.rb:24-28`).
- Impact: satu admin HR bisa baca data penilaian & kandidat perusahaan lain — pelanggaran UU PDP & kepercayaan.

**F-02 | Tenant resolution memakai JWT tanpa verifikasi signature** [DEFECTIVE]
- Bukti: `tenant_resolver_middleware.rb:47` → `JsonWebToken.decode_without_verification`.
- Impact: klien mengontrol `scheme` (via JWT palsu / header / referer) → isolasi tenant rapuh.
- Catatan: serangan penuh butuh kombinasi dgn F-01; F-02 memperluas permukaan.

### P1 — Kandidat tidak dilindungi (UU PDP) & link undangan rapuh

**F-03 | Tidak ada consent & transparansi data (UU PDP)** [MISSING SPEC]
- Bukti: `InterviewPage.tsx` — tidak ada penjelasan data yang dikumpulkan (audio direkam, ditranskrip, dianalisis AI, disimpan), tidak ada persetujuan eksplisit, tidak ada info siapa yang mengakses.
- Impact: pemrosesan data pribadi (termasuk suara/biometrik & transkrip) tanpa dasar consent — pelanggaran UU PDP Pasal 5, 19-20, 29.

**F-04 | `invite_url` salah host** [DEFECTIVE]
- Bukti: session payload → `invite_url: http://localhost:3001/interview/...` (backend), route interview ada di frontend 5173.
- Impact: kandidat yang klik link undangan dapat 404/halaman salah → interview tidak pernah terjadi.

**F-05 | `invite_token` = kunci sesi, bocor & bisa end session tanpa auth** [DEFECTIVE]
- Bukti: (a) `session_json` expose `invite_token` penuh; (b) `audio_complete` (tanpa JWT) dengan hanya token → sesi berakhir `all_covered` padahal interview belum pernah terjadi (verified: session 1 ended tanpa interview).
- Impact: siapa pun dengan link bisa mengakhiri sesi & memicu penilaian kosong → data hasil kandidat korup.

### P2 — Seam data menyebabkan hasil salah & kontrak rusak

**F-06 | Contract mismatch fit-gap: `required_level` vs `expected_level`** [DEFECTIVE]
- Bukti: backend kirim `expected_level`; `ComparisonTable.tsx` baca `c.required_level` → kolom "Required" render **blank**.
- Impact: assessor melihat laporan fit-gap tanpa level yang dibutuhkan → keputusan hiring berdasarkan data tak lengkap.

**F-07 | Fit-gap match by label — label beda dikit = `not_assessed`** [DEFECTIVE]
- Bukti: portfolio skill "Node.js / Backend Development" (SK-ENG-002, L4) vs vacancy skill "Node.js Backend Development" → `not_assessed`; label persis → `exceed`. Skill yang sama, hasil beda.
- Impact: kandidat yang kompeten terlihat "tidak dinilai" → salah filter.

**F-08 | `system_prompt` (10KB) ikut dalam list assessment** [DEFECTIVE]
- Bukti: GET /assessments = 22KB per assessment (termasuk prompt 10KB). List 50 assessment ≈ 1MB.
- Impact: payload berat → list lambat; data internal prompt bocor ke setiap permintaan.

**F-09 | Error internal Gemini bocor ke client** [DEFECTIVE]
- Bukti: `GET /sessions/:id/portfolio` → `generation_error: "API returned 400"` di response.
- Impact: detail internal (API provider, model) terekspos; format error tidak konsisten (`{portfolio, error}` vs `{errors}`).

**F-10 | Anchor L1–L5 wajib diisi manual walau dari taxonomy** [DEFECTIVE]
- Bukti: create assessment → 422 "l1 anchor can't be blank" walau skill SK-ENG-002 dari taxonomy punya anchor.
- Impact: duplikasi data, friction assessor, risiko copy-paste salah → prompt AI pakai anchor keliru.

### P3 — Kualitas, UX, dan baseline

**F-11 | Tidak ada cara bootstrap admin user** [MISSING SPEC]
- Bukti: tabel `users` kosong; tidak ada seed user; `SignupPage.tsx` ada tapi tidak ter-route; endpoint `/signup` tidak ada di backend.
- Impact: fresh install tidak bisa login → produk tak bisa digunakan.

**F-12 | Error contract tidak konsisten + stack trace bocor (dev)** [DEFECTIVE]
- Bukti: 404 routing → `{status, error, exception, traces}` (stack trace); 404 API → `{errors:[{status,message}]}`. Format beda.
- Impact: frontend susah handle error konsisten; info internal bocor kalau RAILS_ENV salah konfigurasi.

**F-13 | Race condition "system_prompt_generated"** [DEFECTIVE]
- Bukti: create assessment response `system_prompt_generated: true` & `system_prompt: null` sebelum worker selesai (verified di runtime).
- Impact: assessor melihat status sukses padahal prompt belum ada; jika langsung buka interview → force-regenerate (ditutup middleware, tapi ada race).

**F-14 | Kandidat hanya melihat 10 turn transkrip terakhir** [DEFECTIVE]
- Bukti: `InterviewPage.tsx:94` `transcript.slice(-9)` (keep last 10); assessor punya transcript penuh + download.
- Impact: kandidat tak bisa meninjau jawabannya sendiri → kurang transparan, menyulitkan verifikasi.

**F-15 | Speed test kirim data ke pihak ketiga tanpa disclosure** [DEFECTIVE]
- Bukti: `internetSpeedTest.ts` upload 0.5MB ke `httpbin.org`/`postman-echo.com`; download dari jsdelivr/unpkg.
- Impact: outbound request pihak ketiga di alur kandidat tanpa pemberitahuan (privasi).

**F-16 | Type definition mismatch `ai_level`** [DEFECTIVE]
- Bukti: `types/index.ts` `ai_level: "L1"|"L2"` (string) vs backend integer. Runtime aman karena `parseLevel` defensif.
- Impact: type contract salah → potensi bug di masa depan; tsc tidak menangkap karena `any`.

**F-17 | Baseline: tidak ada test & CI** [MISSING SPEC]
- Bukti: RSpec kosong, web tanpa test runner, tanpa CI. Logika real-time (audio WS + LiveClient) 1200+ baris tanpa test.
- Impact: regresi sulit dideteksi; ini syarat brief yang harus diisi.

---

## Missing Specification vs Defective Implementation

| Kategori | Temuan |
|---|---|
| **Missing spec (tidak pernah didefinisikan)** | F-03 consent/privasi UU PDP; F-11 bootstrap user/signup; F-17 test & CI; error contract (sebagian); hak akses/hapus kandidat |
| **Defective implementation (didefinisikan tapi rusak)** | F-01, F-02, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-12, F-13, F-14, F-15, F-16 |

---

## Constraint Signal (eskalasi ke Tech Lead)

1. **Model keamanan multi-tenancy tidak aman** (F-01/F-02) — solusi butuh perubahan data model (`users.tenant_id`), perubahan auth, dan migrasi data. Bukan perbaikan kecil.
2. **Sistem real-time (audio WebSocket + Gemini LiveClient) 1200+ baris tanpa test** — perubahan apa pun berisiko regresi; perlu test harness dulu sebelum sentuh.
3. **Dependensi eksternal tunggal (Gemini API)** — key/rate-limit/format respon berubah → portfolio & fit-gap gagal massal (F-09). Perlu fallback & observability.
4. **Ambiguity scope:** target skala tidak terdokumentasi (berapa kandidat paralel? berapa lama audio disimpan?). Mempengaruhi keputusan arsitektur penyimpanan audio & rate limiting.
5. **Seam data rapuh** (F-06/F-07/F-16) — kontrak API & penamaan skill tidak ada standar tunggal; memperbaiki butuh koordinasi api+web.
6. **UU PDP** adalah risiko legal nyata (F-03, F-01) — ini bukan tech-debt tapi kewajiban hukum.
