# Langkah 6 — Final Submission & Report

**Proyek:** AI Interview Platform — Product Engineer Revamp  
**Tanggal laporan:** 24 September 2026  
**Branch:** feature/product-engineer-revamp  
**Status:** Branch `feature/product-engineer-revamp` tersinkron dengan remote sebelum pembaruan laporan ini. Pull Request resmi #133 telah dibuat menurut konfirmasi pemilik branch; perubahan dokumen dalam pembaruan ini akan didorong setelah commit.

> **Catatan status:** URL kanonis PR #133 diberikan oleh pemilik branch. Status review, checks/CI, dan merge belum diverifikasi dalam audit ini.

## 1. Informasi branch dan Pull Request

- Fork/remote: [asyep/ai-interview-platform](https://github.com/asyep/ai-interview-platform)
- Branch kerja: [feature/product-engineer-revamp](https://github.com/asyep/ai-interview-platform/tree/feature/product-engineer-revamp)
- Pull Request resmi: [rakamindev/ai-interview-platform #133](https://github.com/rakamindev/ai-interview-platform/pull/133) (URL dikonfirmasi oleh pemilik branch).
- Base yang terlihat di repository lokal: main pada commit b836d02.
- Commit branch: [19488a0113b5c109f68a151adeca43baa98156b8](https://github.com/asyep/ai-interview-platform/commit/19488a0113b5c109f68a151adeca43baa98156b8) — **feat: complete Option A tenant isolation, login fix, and UI integration**.
- Sebelum pembaruan dokumen ini, HEAD dan `origin/feature/product-engineer-revamp` menunjuk commit `cb0d767` — **docs: sync compliance audit, step-5 monozukuri, and step-6 report draft**. Commit `19488a0` memuat implementasi utama (56 file berubah; +1.686/-240); `2b65d9a` memuat fix URL undangan dan draf Step 6.
- Ringkasan commit: 56 file berubah, sekitar 1.686 penambahan dan 240 penghapusan. Perubahan mencakup otorisasi tenant, validasi evidence AI, generation fit-gap, migrasi/schema, API–UI contract, unit/contract tests, serta dokumentasi Steps 2–5.
- Keberadaan dan URL PR #133 dicatat berdasarkan konfirmasi pemilik branch. `gh auth status` sebelumnya menunjukkan token GitHub invalid, sehingga reviewer, CI/checks, dan status merge tidak terverifikasi secara independen. Jangan menyatakan PR sudah ditinjau atau merge tanpa bukti terbaru.

## 2. Step 1 — Setup & Environment

Audit lokal pada 24 September 2026 mengonfirmasi Ruby 3.3.2, Rails 7.0.10, PostgreSQL 14 siap menerima koneksi, Redis merespons `PONG`, Vite di port 5173 mengembalikan HTTP 200, dan Rails health endpoint di port 3001 mengembalikan HTTP 200. Migrasi development berstatus up. Ini membuktikan environment lokal berjalan saat pemeriksaan; bukan bukti deployment/availability production.

## 3. Executive summary

Revamp ini mengubah temuan audit menjadi satu vertical slice backend–frontend yang berfokus pada kepercayaan data dan kejelasan status. Perbaikan utama mengikat akses ke membership tenant yang eksplisit, memeriksa bukti AI sebelum persistence, menyimpan siklus generation fit-gap agar polling berulang tidak menggandakan pekerjaan, dan menggunakan kontrak API–UI bertipe untuk hasil assessed/not assessed serta override.

Perubahan mengikuti **Option A — vertical slice evidence-first dengan penguatan batas kepercayaan**. Pendekatan ini dipilih untuk menutup risiko P1 utama tanpa membangun platform audit generik yang terlalu besar untuk scope perubahan ini. Hasilnya adalah fondasi teknis yang lebih aman untuk ditinjau, bukan klaim bahwa seluruh risiko produk, hukum, provider AI, dan operasi produksi sudah selesai.

## 4. Narasi perjalanan Steps 2–5

### Step 2 — Domain Immersion

Eksplorasi memetakan dua sisi alur produk:

- **Recruiter/assessor:** konfigurasi assessment dan rubrik L1–L5, mengundang kandidat, memantau coverage, meninjau transkrip/portfolio, melakukan override, membandingkan hasil dengan vacancy, dan mengekspor laporan.
- **Kandidat:** membuka undangan, melewati pemeriksaan perangkat/koneksi, mengikuti wawancara suara, lalu bergantung pada produk untuk mengomunikasikan status, kegagalan, dan pemrosesan datanya.

Nilai produk terletak pada bukti kompetensi yang dapat ditinjau, bukan skor AI semata. Analisis juga mengidentifikasi risiko aksesibilitas dan koneksi, kebutuhan human review, penggunaan audio/transkrip dan inferensi pihak ketiga, serta kewajiban yang perlu dinilai terhadap UU PDP No. 27 Tahun 2022. Catatan Step 2 membedakan perilaku PRD, bukti kode/UI, dan hal yang belum diverifikasi. Tidak ada wawancara Gemini live atau transkrip kandidat nyata pada eksplorasi ini.

### Step 3 — Problem Analysis (P0–P3)

Audit kode api/ dan web/ mencatat **0 temuan P0, 8 P1, 15 P2, dan 2 P3**. Kategori mencakup defective implementation (sudah ada tetapi salah/tidak aman), missing specification (belum didefinisikan/dibuat), serta temuan campuran. Temuan prioritas tertinggi mencakup tenant isolation yang belum ditegakkan di auth/resource turunan, bukti AI yang belum diverifikasi terhadap sumber, polling fit-gap yang dapat mengantrekan job berulang, dan mismatch kontrak API–UI.

Audit juga mengangkat risiko kandidat dan operasional: invite URL diarahkan ke host API alih-alih frontend, status kegagalan yang salah ditampilkan sebagai sesi selesai, retensi/hak kandidat belum didefinisikan, token undangan, logging credential provider, dan kebutuhan audit perubahan keputusan. “Tidak ditemukan P0” adalah hasil audit statis pada scope repo, bukan sertifikasi keamanan atau legal.

### Step 4 — Revamp Strategy dan trade-off

Dokumen strategi membandingkan tiga arah:

| Pendekatan | Dampak vs biaya | Maintainability | Mode kegagalan | Kesesuaian konteks |
|---|---|---|---|---|
| **Option A — vertical slice evidence-first (dipilih)** | Dampak tinggi pada risiko utama dengan biaya sedang; perlu migrasi dan koordinasi API/UI. | Invariant di auth, persistence/service, dan kontrak; tanpa framework generik baru. | Tenant/evidence/generation gagal tertutup; migrasi dan locking tetap perlu diverifikasi pada DB nyata. | Cocok menutup P1 inti dalam scope perubahan saat ini. |
| Option B — patch cepat per gejala | Biaya awal rendah, dampak sebagian; akar risiko tetap terbuka di jalur lain. | Aturan mudah terduplikasi dan kontrak tetap implisit. | Tidak menyelesaikan race lintas tab/server atau isolasi tenant backend. | Cepat, tetapi tidak cukup untuk prioritas keamanan dan integritas data. |
| Option C — platform penilaian auditable | Dampak/kemampuan tertinggi dengan biaya dan scope sangat tinggi. | Dapat sangat baik bila dijaga, tetapi menambah komponen serta beban operasi/upgrade. | Mengurangi risiko jangka panjang bila didanai, dengan lebih banyak sistem dan migrasi. | Arah jangka panjang; terlalu besar untuk perubahan revamp ini. |

Kriteria penerimaan mengatur membership tenant aktif, resource turunan, role REST/WebSocket, validasi rating/evidence, status not_assessed, kegagalan provider, generation idempotent, tipe/null API–UI, dan batas penggunaan hasil AI. Aspek notice, retensi, dasar pemrosesan, keberatan, DPIA, dan transfer vendor tetap memerlukan keputusan pengendali/Legal.

### Step 5 — Monozukuri Implementation

Implementasi Option A meliputi:

1. **Tenant isolation dan autentikasi:** model membership user–organization; login memilih membership aktif yang sesuai X-Tenant-Scheme; REST dan WebSocket memuat ulang otorisasi membership/role; lookup portfolio, report, override, vacancy, ekspor, serta relasi terkait dibatasi pada tenant sesi.
2. **AI evidence dan status penilaian:** validasi tipe rating, confidence, panjang teks, jumlah kutipan, keberadaan kutipan pada turn kandidat tersimpan, dan keterpisahan turn sebelum disimpan. Skill tanpa bukti sah direpresentasikan sebagai not_assessed; nilai tidak di-coerce atau di-clamp menjadi skor sah.
3. **Fit-gap idempotent:** record/status generation tersimpan sebelum job diproses; lock/generation token mencegah polling serentak membuat atau menimpa hasil secara salah; hasil sebelumnya dipertahankan saat regenerate gagal.
4. **Kontrak API–UI:** menyelaraskan expected_level, candidate_level nullable, is_override, evidence dan status. UI memvalidasi respons, menampilkan skill belum dinilai, dan membedakan status terminal dari error/retry.
5. **Harness verifikasi:** RSpec untuk auth/membership, WebSocket, evidence validator dan generation; tes Node untuk kontrak frontend.
6. **URL undangan kandidat:** memperbaiki akar masalah dari demo lokal: Session sebelumnya memakai APP_BASE_URL yang menunjuk Rails API port 3001, sedangkan route /interview/:token dimiliki React. Session kini memakai FRONTEND_BASE_URL, default lokal localhost:5173, memangkas trailing slash, dan gagal eksplisit di production bila domain frontend belum dikonfigurasi.

Pemeriksaan tambahan atas laporan ini menemukan assertion validator benar-benar menangkap batas rating yang rusak: scratch branch lokal `codex/seeded-fault-proof` menyimpan commit fault `96b0315` (rating 6 diterima), lalu test merah (4 examples, 1 failure); commit revert `3561c47` memulihkan batas dan test hijau (4 examples, 0 failures). Branch bukti ini lokal dan belum dipush.

AI-assisted verification juga menemukan kesenjangan review sebelumnya: audit awal mencatat invite URL salah tetapi implementasi Step 5 belum memperbaikinya. Screenshot reproduksi menunjukkan Rails tidak memiliki route `/interview/:token`; verifikasi route membuktikan React/Vite menerima path tersebut. Fix `FRONTEND_BASE_URL` kini masuk commit `2b65d9a`. Ini adalah contoh nyata kegagalan kelengkapan yang dikoreksi, bukan bukti panggilan Gemini live.

Migrasi 20260924000000_add_tenant_memberships_and_generation_state tercatat **up** pada database development lokal saat Step 6 disusun. Dokumen Step 5 merekam status sebelum migrasi lokal dijalankan; pemeriksaan ulang Step 6 memastikan semua migrasi lokal kini up. Membership produksi tetap harus diprovisioning lewat pemetaan organisasi yang diverifikasi; seed admin lokal dibatasi pada environment development.

## 5. Monozukuri Proof

### Seeded Fault Test

Fault injection menggunakan fixture sintetis, bukan data kandidat nyata. Kasus negatif yang dicatat meliputi:

- Rating AI "3" sebagai string, boolean, pecahan, 0, atau 6 alih-alih integer 1–5.
- Kutipan yang tidak terdapat pada transkrip/turn kandidat tersimpan.
- Dua kutipan yang berasal dari turn kandidat yang sama, bukan dua evidence independen.
- Kutipan melewati batas ukuran yang didukung.
- Respons web memakai field lama required_level, tipe level yang salah, atau tidak memiliki is_override.

**Perilaku yang dibuktikan oleh harness:** payload/evidence invalid tidak menjadi rating tersimpan; skill terkait berakhir not_assessed dengan alasan aman. Validator kontrak menolak nama field atau tipe yang tidak sesuai. Ini adalah pengujian validator dan kontrak, bukan fault test provider Gemini live.

Perintah reproduksi dari root repository:

    cd api
    PATH=/Users/asep/.rbenv/versions/3.3.2/bin:$PATH bundle exec rspec spec/services/portfolios/evidence_validator_spec.rb
    cd ../web
    npm test

### AI Verification Moment

Pada fixture sintetis, dua kutipan kandidat yang sesuai dengan turn berbeda (turn 11 dan 12) menghasilkan status assessed, level 3, dan dua turn_id evidence. Varian dengan level berupa string atau kutipan fabrikasi tidak menghasilkan skor dan dipetakan ke not_assessed.

**Batas bukti:** tidak ada panggilan Gemini langsung pada sesi implementasi ini. Hasil offline menunjukkan validator dan jalur penyimpanan bukti bekerja pada fixture, tetapi tidak membuktikan akurasi semantik model, kualitas wawancara/audio end-to-end, ketahanan prompt injection pada provider live, atau keadilan hasil hiring.

### Hasil verifikasi teknis yang tercatat

| Pemeriksaan | Hasil tercatat |
|---|---|
| RSpec API | 12 examples, 0 failures |
| Validator evidence khusus | 4 examples lulus |
| Tes kontrak web | 4 cases lulus |
| rails zeitwerk:check | All is good |
| npm run build | TypeScript dan Vite production build berhasil |
| git diff --check | Bersih |
| Status migrasi development | Seluruh migrasi, termasuk tenant/generation, up |
| Route undangan lokal | Rails runner membentuk URL host frontend; route sintetis di Vite HTTP 200 dan path yang sama pada Rails HTTP 404 sebagaimana diharapkan |

Suite web menggunakan Node native test runner (4 contract tests), bukan Vitest. RSpec berisi 12 unit/service examples dengan test doubles pada beberapa batas; belum ada request/integration suite multi-tenant, component/E2E, atau line/branch coverage. Down migration menolak rollback setelah data `not_assessed` dibuat karena schema sebelumnya mewajibkan level/confidence non-null; rollback aman-fail namun memerlukan restore/forward-fix.

Build Vite memberi peringatan posisi anotasi komentar di dependency Zod; build tetap selesai sukses. Unit/service tests memakai test doubles untuk bagian otorisasi dan generation; tes itu bukan pengganti uji integrasi multi-tenant terhadap PostgreSQL/Sidekiq nyata. Pemeriksaan route undangan adalah verifikasi lokal tambahan, bukan bagian dari suite otomatis.

## 6. Video walkthrough (3–5 menit)

**Target durasi: sekitar 4 menit.** Gunakan data sintetis dan hindari merekam kredensial, token, transkrip kandidat, atau informasi pribadi.

| Waktu | Bagian | Poin narasi dan tampilan |
|---|---|---|
| 0:00–0:25 | Pembuka | Sebut tujuan revamp: hasil interview perlu aman lintas tenant, dapat ditelusuri ke bukti, dan punya status yang jujur. Tampilkan branch dan PR #133. |
| 0:25–0:55 | Domain dan masalah | Jelaskan alur assessor dan kandidat. Tampilkan ringkasan Step 3: 0 P0, 8 P1, 15 P2, 2 P3; tekankan bahwa audit juga menemukan gap spesifikasi kandidat/PDP. |
| 0:55–1:25 | Keputusan desain | Tampilkan Option A pada Step 4. Terangkan membership sebagai sumber akses tenant, validasi evidence server-side, status generation tersimpan, dan kontrak API/UI tunggal. |
| 1:25–2:10 | Tenant/auth | Perlihatkan login development dan halaman assessor. Jelaskan selector X-Tenant-Scheme memilih membership yang sudah sah; header sendiri tidak memberi akses. Jangan tampilkan password atau JWT. |
| 2:10–2:50 | Evidence dan not assessed | Tampilkan fixture sintetis/hasil test. Bandingkan dua kutipan valid dari turn berbeda dengan skor string/kutipan palsu yang ditolak dan menjadi not_assessed. |
| 2:50–3:25 | Fit-gap, kontrak, dan invite | Jelaskan generation idempotent, expected_level/is_override, lalu tunjukkan link undangan mengarah ke route React localhost:5173, bukan ke server API Rails. |
| 3:25–3:50 | Bukti dan batasan | Tampilkan ringkasan build/tests dan status migrasi. Nyatakan AI Verification Moment bersifat offline; Gemini live, review dua tenant terintegrasi, dan validasi semantik belum diklaim. Sebut URL invite fix dan draf Step 6 masih lokal jika belum didorong. |
| 3:50–4:10 | Penutup/submission | Sebut commit utama 19488a0, follow-up 2b65d9a, branch dan PR #133, serta tindak lanjut: CI/DB integration, uji REST/WebSocket dua tenant, dan keputusan PDP/Legal. |

### Checklist rekaman

- Gunakan akun development dan fixture sintetis; jangan rekam kredensial, token, data kandidat, atau log berisi payload autentikasi.
- Pastikan browser membuka branch/build yang sedang dijelaskan, dan tutup tab/notifikasi yang tidak relevan.
- Sebutkan PR #133 sebagai PR yang telah dibuat; jangan menyiratkan review/merge sebelum status tersebut dikonfirmasi.
- Gunakan subtitle atau narasi yang menyebut batas demo serta status live-provider secara eksplisit.

## 7. Status kelengkapan submission dan tindak lanjut

Dokumen ini masih **draf Markdown**, belum PDF siap unggah. Bukti screenshot yang tersedia adalah reproduksi sebelum fix dan memuat konten/token lokal; screenshot final yang sudah disanitasi, variasi responsive/edge/error states, tautan video eksternal 3–5 menit, serta bukti upload ke hiring platform belum tersedia. Outline video sudah ditulis, tetapi bukan rekaman. PR #133 sudah dibuat menurut konfirmasi pemilik branch; status CI/reviewer/merge belum diverifikasi.

Sebelum menyatakan siap produksi atau kepatuhan penuh, tim masih perlu:

1. Menjalankan CI/integration dengan PostgreSQL dan Sidekiq untuk unique constraint, transaksi/locking lintas koneksi, worker retry, migrasi pada DB kosong/upgrade, serta akses dua tenant yang disetujui.
2. Melakukan verifikasi WebSocket/REST black-box dengan membership/role berbeda; memastikan provisioning produksi diberikan berdasarkan pemetaan organisasi terverifikasi.
3. Menjalankan uji provider AI live pada data sintetis yang disetujui, mengukur kualitas evidence/level dan perilaku prompt injection; jangan menjadikan skor otomatis keputusan final.
4. Meminta Pengendali/Legal menentukan dasar pemrosesan, notice, retensi/pemusnahan, pemenuhan hak dan keberatan kandidat, DPIA bila relevan, kontrak pemroses, serta lokasi/transfer data provider.
5. Setelah bukti visual final dan video tersedia, hasilkan satu PDF final, verifikasi render tiap halaman, unggah ke hiring platform, lalu simpan URL video dan bukti submission.
6. Pastikan commit pembaruan dokumen ini masuk ke branch PR #133, lalu verifikasi CI/reviewer/status merge dengan akses GitHub yang valid.

## Lampiran — berkas pendukung

- [Step 2 — Domain Immersion](docs/step-2-domain-immersion.md)
- [Step 3 — Problem Analysis](step-3-problem-analysis.md)
- [Step 4 — Revamp Strategy](step-4-revamp-strategy.md)
- [Step 5 — Monozukuri Execution](step-5-monozukuri-execution.md)
