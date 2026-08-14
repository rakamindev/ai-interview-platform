# Step 4 — Revamp Strategy, Acceptance Criteria & Trade-offs

**Revamp: "Candidate Trust & Assessment Integrity"**
Satu tema besar: melindungi kandidat (UU PDP + keadilan) DAN memastikan hasil penilaian akurat. Menutup temuan P0–P2 terverifikasi.

---

## 1. Scope Revamp

| Modul | Temuan yang ditutup | Perubahan |
|---|---|---|
| **BACKEND — Consent & transparansi (inti)** | F-03 (UU PDP), F-05 (integritas sesi) | Model `CandidateConsent` + endpoint consent + gating interview |
| **BACKEND — Keamanan tenant** | F-01 (cross-tenant), F-02 (JWT tanpa verifikasi) | Bind user ke tenant; scheme diturunkan dari user, bukan header klien |
| **BACKEND — Invite & kontrak** | F-04 (invite_url host), F-05 (invite_token bocor) | `WEB_BASE_URL` terpisah; hapus `invite_token` dari payload assessor; **guard `audio_complete`** — tolak end-session 422 tanpa consent accepted + tanpa bukti sesi berjalan (status active + minimal 1 transcript turn), idempoten tetap 200 |
| **FRONTEND — Layar consent** | F-03 | Layar disclosure UU PDP sebelum interview + gating tombol start |
| **FRONTEND — Kontrak fit-gap** | F-06 (Required blank), F-16 (tipe) | Fix `ComparisonTable` + types |
| **FRONTEND — Presentasi hasil penilaian** | F-06 (lanjutan), + masalah presentasi yang ditemukan saat walkthrough (lihat §1a) | Revamp layar Fit-Gap & Portfolio: instrumen L1–L5 tunggal, `not_assessed` dibedakan dari gap, bukti kutipan didekatkan ke keputusan, seluruh state ditangani |

**Tidak termasuk (sengaja):** F-08 (optimasi payload list), F-14 (transcript kandidat penuh), F-15 (speed test pihak ketiga) — di-list sebagai follow-up, bukan bagian revamp ini agar scope terkendali dalam deadline. F-17 (test/CI) WAJIB disertakan sebagai harness untuk membuktikan semua di atas.

**Klaim depth: fullstack seimbang.** Backend: model consent + API + gating WS + guard `audio_complete` + tenant binding. Frontend: layar consent, perbaikan kontrak fit-gap, dan revamp presentasi hasil penilaian (§1a). Kedua sisi dikerjakan sampai ke test.

---

## 1a. Kenapa presentasi hasil ikut direvamp

Temuan F-06 awalnya dibaca sebagai bug kontrak: kolom "Required" kosong karena frontend membaca `required_level` sedangkan backend mengirim `expected_level`. Setelah kolom itu diisi, masalah yang lebih besar baru kelihatan saat menelusuri layar sebagai hiring manager:

**Skill yang tidak pernah ditanyakan tampil sama seperti skill yang nilainya kurang.**
`ComparisonTable` merender `not_assessed` dengan baris dan bobot visual yang sama seperti `gap`. Pembacanya menyimpulkan kandidat lemah di skill itu, padahal wawancaranya yang tidak pernah menggalinya. Ini kesalahan yang menimpa kandidat — orang yang tidak memilih memakai produk ini dan tidak bisa membantah hasilnya.

Konsekuensinya, memperbaiki kontrak data saja tidak menyelesaikan kerugiannya. Yang harus berubah adalah cara level dibaca:

1. **Satu instrumen ukur untuk seluruh produk.** L1–L5 selalu digambar sebagai lima segmen. Di fit-gap instrumen yang sama membawa dua penanda — level yang disyaratkan dan level yang dicapai — sehingga gap terbaca sebagai **jarak**, bukan hasil pengurangan angka.
2. **`not_assessed` = tidak ada pengukuran.** Track digambar putus-putus dan kosong, diberi label kata "Belum dinilai", dan tidak pernah memakai warna gap.
3. **Merah dikunci untuk kegagalan sistem.** Kandidat yang levelnya di bawah syarat memakai clay, bukan merah. Manusia yang belum memenuhi syarat bukan error, dan mewarnainya seperti error mendorong pembaca ke arah menolak.
4. **Bukti didekatkan ke keputusan.** Kutipan verbatim kandidat tampil di baris perbandingan, bukan hanya di layar terpisah, supaya penilaian dan alasannya terbaca bersamaan.
5. **Kata-kata kandidat dibedakan secara tipografis** dari kesimpulan AI (serif vs sans), sehingga pembaca bisa memisahkan kesaksian dari inferensi tanpa membaca label.

**Asumsi yang diambil:** produk ini dinilai juga pada kualitas UI/UX, dan brief menyebut "menggunakan atau memperluas design system". Menambah tiga typeface (IBM Plex Sans/Mono, Source Serif 4) dan empat token warna hasil penilaian dihitung sebagai *memperluas*, bukan mengganti: token dasar, komponen Radix, dan warna brand Rakamin (`#01959f`, `#FBC037`) tidak diubah.

---

## 2. Self-Defined Acceptance Criteria

Ditulis sebelum coding. Setiap input & edge case didefinisikan.

### A. Consent API (backend)

| # | Given | When | Then |
|---|---|---|---|
| A1 | Token valid, session pending | GET `/api/v1/sessions/:token/consent` | 200 `{policy_version, data_collected[], purposes[], retention_days, rights[], contact, language}` |
| A2 | Token tidak ada/salah format | GET consent | 404 `{errors:[{status:404}]}` |
| A3 | Token valid | POST consent `{status:"accepted"}` | 200 `{consent:{status:"accepted", accepted_at}}`; record tersimpan |
| A4 | Token valid | POST consent `{status:"declined"}` | 200 `{consent:{status:"declined"}}` |
| A5 | Consent sudah ada (accepted) lalu POST lagi accepted | POST | **Idempoten** — 200, update accepted_at, tidak duplikat (unique session) |
| A6 | Consent declined lalu POST accepted | POST | 200 accepted (kandidat boleh berubah pikiran) |
| A7 | Session sudah ended | POST consent | 422 `Session has ended` |
| A8 | Body kosong / status bukan accepted\|declined | POST | 422 `Invalid consent status` |
| A9 | Token valid | POST | `consent_ip` & `user_agent` tercatat (audit trail UU PDP) |
| A10 | Session ended | GET candidate_info | `status:"ended"` + `consent_required` tetap dikembalikan, tidak error |

### B. Gating interview (backend + WS)

| # | Given | When | Then |
|---|---|---|---|
| B1 | Tidak ada consent accepted | kandidat buka link | `candidate_info` → `consent_required: true, consent_status: "pending"` |
| B2 | Consent accepted | kandidat buka link | `consent_required: false` (atau `accepted`) → langsung ke hardware check |
| B3 | Tidak ada consent accepted | connect audio WS | Ditutup dgn `{type:"error", code:"consent_required", recoverable:false}` — **defense in depth**, tak boleh mulai interview |
| B4 | Consent accepted | connect audio WS | Interview jalan normal (StartHandler) |
| B5 | Session ended | connect audio WS | `Session has ended` (perilaku existing, tetap) |
| B6 | Gemini gagal / timeout | — | Perilaku existing (reconnect/error) TIDAK berubah — consent bukan bagian path AI |

### C. Keamanan tenant (backend)

| # | Given | When | Then |
|---|---|---|---|
| C1 | User admin milik tenant A | login DENGAN `X-Tenant-Scheme: tenant-B` | Token tetap ber-`scheme: tenant-A` — **header diabaikan untuk token** |
| C2 | User admin milik tenant A | login TANPA header | Token ber-`scheme: tenant-A` |
| C3 | User tanpa tenant_id (legacy) | login | 403 `User has no tenant assigned` (atau konfigurasi default via ENV) |
| C4 | Tenant resolver menerima JWT tak terverifikasi | request apa pun | Tidak digunakan untuk otorisasi; tenant hanya dari JWT terverifikasi / user record |
| C5 | Token tenant A akses resource tenant B | request | 404/403 — data tersembunyi (default_scope tetap) |

### D. Invite & payload (backend)

| # | Given | When | Then |
|---|---|---|---|
| D1 | Session dibuat | response session | `invite_url` = `WEB_BASE_URL` (frontend) + `/interview/:token`, bukan `APP_BASE_URL` |
| D2 | Assessor minta session (index/show) | response | **`invite_token` TIDAK ada** di payload; hanya `invite_url` |
| D3 | Candidate endpoint (`audio_complete`) | request | Tetap token-based (kandidat butuh), tetap rate-limited (existing) |

### E. Frontend — layar consent

| # | Given | When | Then |
|---|---|---|---|
| E1 | Consent required & pending | buka InterviewPage | Muncul layar disclosure: data dikumpulkan, tujuan, durasi simpan, hak kandidat, kontak — **scrollable**, bahasa sesuai assessment (en/id) |
| E2 | Checkbox belum dicentang | klik "Start Interview" | Tombol disabled |
| E3 | Checkbox dicentang | klik "Mulai Interview" | POST consent accepted → lanjut hardware check → interview |
| E4 | Kandidat pilih "Tidak menyetujui" | klik | Layar decline: "Kamu tidak bisa lanjut tanpa persetujuan" + kontak + tombol kembali |
| E5 | Gagal fetch consent (network/model) | buka halaman | State error + tombol "Coba lagi" (loading/error state) |
| E6 | Consent sudah accepted (refresh/re-open) | buka halaman | Skip layar consent langsung (tidak minta ulang) |
| E7 | Layar sempit / teks panjang | buka di mobile | Layout responsif, panel scroll, tombol tetap terjangkau |
| E8 | Session ended | buka halaman | Layar "Interview Complete" (existing), consent tidak menghalangi |

### F. Kontrak fit-gap (frontend)

| # | Given | When | Then |
|---|---|---|---|
| F1 | Fit-gap report di-fetch | render ComparisonTable | Kolom "Required" menampilkan L1–L5 dari `expected_level` (tidak blank) |
| F2 | tipe di `types/index.ts` | build | `SkillComparison.required_level`→`expected_level`; `ai_level` number; `tsc --noEmit` lolos |
| F3 | `not_assessed` skill | render | Tampil "—" & "Not assessed" (existing) |

### G. Data safety (migration)

| # | Given | When | Then |
|---|---|---|---|
| G1 | Migration dijalankan di DB dengan rows existing | `db:migrate` | Berhasil tanpa drop data; kolom baru nullable/backfill aman |
| G2 | Rollback | `db:rollback` | Reversible (drop table/kolom) |
| G3 | Tidak ada data pribadi baru di log | consent POST | Hanya status+timestamp di log, bukan audio/transkrip |

### H. Presentasi hasil penilaian (frontend)

Ditulis sebelum coding, berlaku untuk layar Fit-Gap dan Portfolio.

| # | Given | When | Then |
|---|---|---|---|
| H1 | `result: "not_assessed"` | render baris fit-gap | Track putus-putus & kosong, label "Belum dinilai", **tidak** memakai warna gap/merah; tidak ada angka level yang dikarang |
| H2 | `candidate_level < expected_level` | render | Warna clay (`--gap`), bukan `--destructive`; delta ditulis mono (`-2`) sebagai konfirmasi, bukan sinyal utama |
| H3 | delta −1 vs −2 | render berdampingan | −2 terbaca lebih berat secara visual tanpa membaca angkanya |
| H4 | `is_override: true` | render | Penanda "Disesuaikan asesor" + tooltip; level hasil override jadi primer, level AI jadi konteks sekunder |
| H5 | `ai_confidence: "low"` | render kartu portfolio | Peringatan eksplisit bahwa skill hanya digali sebentar; memakai aksen kuning (perhatian), bukan merah |
| H6 | `evidence: []` | render kartu | State kosong yang menjelaskan belum ada kutipan — bukan kartu kosong tanpa penjelasan |
| H7 | `evidence` berisi 4 kutipan panjang (>3 kalimat) | render | Dua kutipan pertama tampil, sisanya di balik "Tampilkan semua"; layout tidak pecah |
| H8 | `skill_label` sangat panjang (>60 karakter) | render | `overflow-wrap` menahan layout; track dan angka tidak tergeser |
| H9 | Laporan sedang digenerate | buka layar | Skeleton yang meniru layout asli + estimasi waktu; bukan spinner di tengah layar |
| H10 | `generation_status: "failed"` | buka layar | Penjelasan bahasa manusia + tombol coba lagi; **tidak** menampilkan pesan error mentah dari provider AI (lihat F-09) |
| H11 | Sebagian data siap (perbandingan ada, narasi belum) | buka layar | Bagian yang siap tampil, bagian yang belum diberi skeleton — halaman tidak diblokir seluruhnya |
| H12 | Belum ada laporan sama sekali | buka layar | State kosong yang menjelaskan apa yang kurang + satu aksi lanjutan |
| H13 | Viewport 375px | buka kedua layar | Layout responsif nyata (baris jadi tumpukan), aksi tetap terjangkau, tidak ada scroll horizontal |
| H14 | Kutipan verbatim kandidat | render di mana pun | Selalu serif; teks yang dihasilkan AI selalu sans — pembatas ini konsisten di semua layar |
| H15 | Mode gelap aktif | render | Seluruh token hasil penilaian punya varian gelap; kontras teks tetap terbaca |
| H16 | Pengguna hanya melihat warna (uji grayscale) | render | Setiap status tetap terbaca lewat label kata + bentuk, bukan warna saja |

---

## 3. Solution Options & Trade-offs

### Keputusan 1 — Cara implementasi consent

**Option A: Consent gating penuh (session-level, server-recorded)**
- Backend simpan `CandidateConsent`; interview TIDAK bisa mulai tanpa accepted; audit trail (IP, UA, timestamp, policy_version).
- *Product Impact:* Jaminan kepatuhan UU PDP yang bisa dibuktikan ke auditor/enterprise; kandidat paham & bisa menolak → kepercayaan.
- *Cost:* 1 model + 2 endpoint + gating WS + 1 layar frontend. Sedang.
- *Maintainability:* mudah; policy statis (versioned constant), bisa diubah version tanpa schema change.
- *Failure modes:* kalau consent fetch gagal → kandidat terkunci? Solusi: frontend error+retry; backend gating hanya di start (bukan sepanjang sesi), jadi interview yang sudah jalan tak terpengaruh.
- *Contextual fit:* persis kebutuhan UU PDP; scope terkendali.

**Option B: Disclosure banner pasif (tanpa gating, tanpa record)**
- *Impact:* hampir nol; tidak memenuhi "wajib persetujuan" UU PDP; tidak ada bukti audit.
- *Cost:* paling murah.
- *Forecloses:* pelanggan enterprise/legal; pembuktian kepatuhan.
- **Rejected:** gagal memenuhi tujuan utama.

**Option C: Privacy center penuh (policy via DB + admin UI + portal kandidat utk akses/hapus data)**
- *Impact:* paling lengkap (termasuk hak akses/hapus), tetapi jauh melampaui scope deadline.
- *Cost:* tinggi; butuh admin UI, migrasi policy, portal baru, alur erasure.
- *Failure modes:* setengah jadi = fitur setengah rusak → risiko disqualifier "tested happy path only".
- **Ditunda:** jadikan road-map; versi awal cukup consent + transparansi. Hak akses/hapus di-arahkan ke kontak (dokumentasi) dulu.

**→ Pilih Option A** (nilai kepatuhan maksimum / biaya terkendali).

### Keputusan 2 — Perbaikan cross-tenant

**Option A: Bind user ke tenant; scheme dari user record**
- `users.tenant_id` + resolve_scheme baca `user.tenant_id`; `X-Tenant-Scheme` diabaikan utk mint token.
- *Impact:* menutup P0; isolasi tenant jadi berbasis identitas, bukan header klien.
- *Cost:* migration + kecil di auth controller + tests. Terkendali.
- *Maintainability:* arah yang benar; tenant = relasi user, mudah dipahami.
- *Failure modes:* user legacy tanpa tenant_id → 403 (jelas); perlu prosedur assign. Diterima.

**Option B: Validasi header = org user**
- Header tetap dipakai tapi harus cocok dgn org user. Lebih sedikit perubahan.
- *Failure modes:* jika user belum punya org, fallback ambigu; masih ada permukaan header-spoofing di path lain.
- *Contextual fit:* tambal sulam, tidak menyelesaikan akar.

**→ Pilih Option A.**

### Keputusan 3 — Fix seam fit-gap

**Option A: Fix dua sisi (backend kembalikan kontrak konsisten + frontend pakai key benar)**
- Backend: pastikan `skill_comparisons` memakai `expected_level` (sudah) + tambahkan `required_level` alias ATAU dokumentasi kontrak; Frontend: pakai `expected_level`; types dibetulkan.
- *Maintainability:* satu sumber kebenaran.
- **→ Pilih A.** (Tambahan: canonical skill matching by `skill_id` di `FitGap::Engine.find_portfolio_skill` — prioritaskan skill_id sebelum label.)

### Keputusan 4 — Cara mendapatkan arah visual untuk revamp presentasi

Dua arah dieksplorasi lebih dulu sebagai mockup, lalu dibandingkan sebelum satu baris kode UI ditulis.

**Option A: Mockup HTML statis memakai token codebase**
- Semua state digambar sebagai frame terpisah (loaded/loading/empty/error/partial/teks panjang/mobile 375px), memakai variabel CSS dan warna brand yang persis sama dengan aplikasi.
- *Product Impact:* cakupan state lengkap, dan setiap layar bisa langsung dicek terhadap acceptance criteria H1–H16.
- *Cost:* rendah; porting ke React nyaris mekanis karena token sudah sama.
- *Kelemahan:* tanpa shell aplikasi (sidebar, breadcrumb), layar terbaca sebagai lembar spesifikasi, bukan produk. Kualitas komposisi lebih lemah.

**Option B: Generator UI eksternal (v0)**
- *Product Impact:* komposisi paling kuat — shell aplikasi, ritme baris yang mendekatkan bukti ke keputusan, pemisah kutipan/narasi yang rapi.
- *Cost:* tinggi kalau diadopsi apa adanya. Keluarannya Next 16 + React 19 + Tailwind v4 (aplikasi ini Vite + React 18 + Tailwind v3), tanpa Radix sama sekali, dan memakai palet karangan sendiri (`#087f73` / `#e8bb27`) alih-alih warna brand Rakamin.
- *Failure modes:* mengarang data yang tidak ada di model — skor agregat "76/100", `ai_confidence` sebagai float `0.91` (API mengembalikan `high|medium|low`), metrik "Evidence Health", sumber bukti "Reference · 2023". Angka penilaian yang tidak punya metode adalah presisi palsu pada produk yang memutuskan nasib orang. Layar consent-nya bahkan datang dengan **checkbox tercentang default** — secara UU PDP itu bukan persetujuan.
- *Forecloses:* memasukkannya utuh berarti menjalankan dua sistem UI paralel di satu aplikasi.

**→ Pilih A untuk isi, arah komposisi diambil dari B.** Struktur layout (shell, ritme baris, kedekatan bukti dengan keputusan) diadopsi; palet dikembalikan ke token Rakamin; seluruh metrik karangan dibuang; cakupan state dan kejujuran terhadap data model mengikuti Option A. Yang dibuang dari B adalah penghapusan — murah. Yang diambil dari B adalah komposisi — mahal kalau dibangun dari nol.

*Catatan verifikasi AI:* kedua mockup dihasilkan dengan bantuan AI, dan keduanya salah pada titik yang berbeda — dicatat di bagian AI Verification pada laporan Step 5.

---

## 4. Data Model & Migration

```ruby
# create_candidate_consents  (reversible, no backfill needed)
create_table :candidate_consents do |t|
  t.references :session, null: false, foreign_key: true, index: { unique: true }
  t.string  :policy_version, null: false, default: "1.0"
  t.string  :status, null: false, default: "pending"   # pending|accepted|declined
  t.datetime :accepted_at
  t.datetime :declined_at
  t.string  :consent_ip
  t.string  :consent_user_agent
  t.timestamps
end

# add tenant to users (reversible)
add_column :users, :tenant_id, :bigint, null: true
add_index  :users, :tenant_id
```

**Safety terhadap existing rows:** tabel baru → aman; `users.tenant_id` nullable → rows lama tak rusak, di-403 sampai di-assign (dokumentasi prosedur assign).

**Policy content:** constant versioned di `app/services/consent_policy.rb` — `ConsentPolicy::POLICY_VERSION` (saat ini `"1.0"`) + `ConsentPolicy.content(language)` untuk en/id. Bukan DB, supaya versi policy bisa naik tanpa migration dan tanpa admin UI di scope ini.

---

## 5. Strategi Test (Step 5)

- **Backend (RSpec, model+request+service):** consent create/update/idempotent/declined→accepted; gating WS (unit middleware); tenant binding login; fit-gap skill_id matching. Harness: `spec/` baru, factory_bot + database_cleaner (sudah ada di Gemfile).
- **Frontend (Vitest + RTL):** consent screen states (loading/error/accepted/declined/checkbox), contract render. Runner baru (baseline web tanpa test).
- **Seeded fault test:** rusak `find_portfolio_skill` → test fit-gap gagal → revert.
- **AI verification moment:** dokumentasikan 1 kasus AI code salah.

---

## 6. Risiko & Asumsi

- **Asumsi:** consent cukup per-session (bukan per-assessment global); policy "1.0" statis di code; `WEB_BASE_URL` env baru default `http://localhost:5173`.
- **Risiko:** gating WS baru bisa nge-block flow candidate kalau consent fetch gagal → dirancang frontend retry + error state; WS gating hanya reject tanpa accepted (tidak menyentuh path audio yang jalan).
- **Keluar dari scope:** optimasi payload, transcript penuh kandidat, erasure portal penuh — dokumentasi sebagai road-map.
