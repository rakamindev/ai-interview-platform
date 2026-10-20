# Findings: masalah inti, temuan, dan acceptance criteria

> Dokumen ini dipakai dua arah: sebagai bahan laporan (Step 3 & 4) dan sebagai pegangan saat eksekusi (Step 5). Kalau ada keraguan saat ngoding, jawabannya harus ada di sini. Kalau tidak ada, berarti belum diputuskan: tulis dulu di sini, baru dikerjakan.
>
> Terakhir diperbarui: 20 Oktober 2026.

## 1. Masalah inti dalam satu paragraf

Produk ini dibuat supaya assessor, recruiter, dan hiring manager bisa mengambil keputusan hiring dari bukti yang bisa dibela: level per skill, kutipan jawaban kandidat, dan perbandingan dengan kebutuhan role. Kenyataannya, **ketika bukti tidak ada, sistem tetap mengeluarkan angka**. Skill yang sama sekali tidak ditanyakan disimpan sebagai L1, ditampilkan sebagai "L1 Foundational", dihitung sebagai "Gap", lalu narasi AI menyimpulkan kandidat "not recommended". Di sisi lain, koreksi dari manusia (override) bisa hilang tanpa jejak, laporan fit/gap bisa basi tanpa tanda, dan data penilaian satu klien bisa dibaca serta diubah oleh klien lain.

Akibatnya:
- **Pengguna** tidak bisa memercayai hasilnya. Begitu sekali saja ketahuan salah, mereka kembali ke wawancara manual.
- **Kandidat** bisa kalah karena hal yang tidak pernah ditanyakan kepadanya, padahal dia tidak memilih dinilai oleh sistem ini dan tidak bisa menolaknya.

## 2. Cara temuan ini didapat

Semua temuan bertanda ✅ direproduksi langsung di aplikasi lokal: API Rails di port 3001, web Vite di 5173, Sidekiq, dan Gemini sungguhan. Yang bertanda 🔍 baru dari membaca kode dan masih harus dibuktikan.

**Skenario utama yang dipakai (bisa diulang):**
1. Login sebagai admin, lalu buat assessment "Backend Engineer (gap test)" berisi 3 skill: Technical Writing & Documentation (L3), System Design (L4), dan Stakeholder Communication (L3).
2. Buat undangan untuk kandidat fiktif "Kandidat Uji".
3. Jalankan sesi lewat WebSocket. Suara kandidat dibuat dengan `say` (16 kHz PCM). Kandidat hanya membahas dokumentasi, lalu mengakhiri sesi di menit pertama.
4. Buat vacancy dengan 3 skill yang sama, jalankan fit/gap, lalu override satu skill.
5. Periksa tabel `portfolio_skills`, `assessor_overrides`, `fit_gap_reports`, `coverage_maps`, dan `transcript_turns`, payload API, serta tampilan layar Portfolio dan Fit/Gap.
6. Uji akses lintas tenant dengan organisasi kedua sementara, yang sudah dihapus lagi setelah uji.

**Cara membaca kolom tabel:**
- **Severity.**
  - P0: hasil penilaian salah, atau data kandidat bocor.
  - P1: workflow rusak atau menyesatkan, tapi masih bisa diakali.
  - P2: membingungkan atau tidak konsisten.
  - P3: kenyamanan, atau hanya berdampak ke developer.
- **Jenis.**
  - **Belum didefinisikan**: tidak pernah ada di spesifikasi (PRD), jadi tidak ada yang tahu perilaku benarnya seperti apa.
  - **Rusak di implementasi**: sudah dirancang, tapi hasilnya tidak sesuai rancangan.

## 3. Tabel temuan

| ID | Temuan dan bukti | Severity | Dampak pengguna | Keputusan | Status |
|---|---|---|---|---|---|
| F-01 | **Skill yang tidak ditanyakan tetap diberi L1, dihitung "Gap", dan jadi alasan "not recommended".** Jenis: belum didefinisikan (PRD tidak mengatur skill yang tidak sempat dinilai) dan rusak di implementasi (hasil `not_assessed` sudah ada di engine fit/gap, tapi tidak pernah tercapai). Layanan: api + web. Bukti ✅: di session 9, System Design dan Stakeholder Communication berstatus coverage `not_yet` dengan 0 probe, dan LLM sendiri menulis "This skill was not evaluated". Namun DB menyimpan `ai_level=1`. Kolomnya memang `NOT NULL CHECK 1..5`, dan `generator.rb:161` melakukan `.to_i.clamp(1,5)`. Hasil fit/gap: Gap −3 dan −2. Narasinya berbunyi: *"significant capability gaps … not recommended"*. | P0 | Hiring manager menolak kandidat berdasarkan skill yang tidak pernah ditanyakan. | Implementasikan | Selesai (belum di-commit) |
| F-02 | **Klien lain bisa membaca dan mengubah hasil penilaian kandidat.** Jenis: rusak di implementasi. Layanan: api. Bukti ✅: admin organisasi kedua mendapat 200 untuk `GET /portfolios/6/fitgap/2` dan `GET /portfolios/6/export` (isinya kutipan jawaban kandidat), serta 201 untuk `POST /portfolio_skills/20/override`. Penyebabnya, `Portfolio.find` tanpa scope tenant (`portfolios_controller.rb:82,104,130,156`) dan `PortfolioSkill.joins(:portfolio).find` (`portfolio_skills_controller.rb:51`). | P0 | Data pribadi kandidat bocor antar-klien (UU PDP), dan nilai kandidat bisa diubah oleh pihak luar. | Implementasikan | Selesai (belum di-commit) |
| F-03 | **Override assessor hilang diam-diam saat portfolio dibuat ulang, dan job pembuat portfolio bisa jalan berkali-kali.** Jenis: rusak di implementasi. Layanan: api. Bukti ✅: override System Design (L1 ke L4) tersimpan, lalu jumlah override di DB jadi 0 setelah job berikutnya selesai. Penyebabnya `portfolio_skills.destroy_all` (`generator.rb:154`) yang ikut menghapus `assessor_override` lewat `dependent: :destroy`. Log mencatat 6+ run N10 untuk satu sesi. | P0 | Keputusan manusia terhapus tanpa jejak, sehingga prinsip "manusia yang memutuskan" tidak berlaku. | Implementasikan | Selesai (belum di-commit) |
| F-04 | **Laporan fit/gap basi tanpa tanda.** Jenis: rusak di implementasi. Layanan: api + web. Bukti ✅: laporan masih menampilkan System Design L5 "Exceeds +1" dari override yang sudah tidak ada, dan narasinya memuji *"advanced system design capabilities"* untuk skill yang tidak pernah dibahas. Laporan dibuat 04:09:21, portfolio diperbarui 04:09:55, dan tidak ada penanda bahwa laporan sudah tidak sesuai. | P1 | Hiring manager membaca laporan yang bertentangan dengan portfolio. | Implementasikan | Selesai (belum di-commit) |
| F-05 | **Kolom Required di fit/gap selalu kosong, dan tanda override tidak pernah muncul.** Jenis: rusak di implementasi (kontrak api↔web tidak cocok). Layanan: api + web. Bukti ✅: API mengirim `expected_level`, sedangkan web membaca `required_level` (`ComparisonTable.tsx:50`). Engine sudah menghitung `overridden`, tapi tidak memasukkannya ke payload, sehingga `is_override` (`ComparisonTable.tsx:56`) selalu undefined. Screenshot menunjukkan kolom Required kosong di semua baris. | P1 | Perbandingan kandidat dengan kebutuhan role tidak bisa dibaca, dan pembaca tidak tahu angka mana yang dikoreksi manusia. | Implementasikan | Selesai (belum di-commit) |
| F-06 | **Layar portfolio menampilkan "L1 Foundational" untuk skill yang tidak dinilai, dan tidak menjelaskan bahwa sesi berakhir lebih awal.** Jenis: rusak di implementasi (tampilan). Layanan: web. Bukti ✅: badge abu-abu "L1" tampil berdampingan dengan teks "This skill was not evaluated", di bawah banner "Only briefly explored". Tidak ada info durasi sesi (78 detik dari 10 menit) atau alasan sesi berakhir. | P1 | Assessor membaca "L1" sebagai penilaian, bukan sebagai tidak adanya data. | Implementasikan | Selesai (belum di-commit) |
| F-07 | **Output LLM diterima apa adanya.** Jenis: belum didefinisikan. Layanan: api. Bukti: level di luar 1..5 atau nilai kosong dipaksa jadi 1 lewat `.to_i.clamp` 🔍. Skill yang tidak disebut LLM tidak punya aturan 🔍. Kutipan bukti tidak dicocokkan ke transkrip 🔍. Transkripsi yang salah dengar ("wet hook" untuk "webhook") bisa masuk sebagai kutipan ✅. | P1 | Satu jawaban model yang ngawur langsung jadi nilai kandidat. | Implementasikan | Selesai (belum di-commit) |
| F-08 | **Kegagalan pembuatan portfolio tidak tertangani dengan jelas.** Jenis: belum didefinisikan (perilaku saat gagal) dan rusak di implementasi. Layanan: api + web. Bukti ✅: Gemini 503 dan timeout 180 detik terjadi berulang. Status bolak-balik `failed` dan `generating` karena retry. UI hanya menampilkan "Portfolio generation failed." tanpa alasan. Regenerasi yang gagal membuat hasil sebelumnya ikut hilang. | P1 | Assessor tidak tahu harus menunggu, mencoba lagi, atau melapor. | Implementasikan | Selesai (belum di-commit) |
| F-09 | **Password login tercatat apa adanya di log.** Jenis: rusak di implementasi (filter bawaan Rails tidak ada). Layanan: api. Bukti ✅: `api/log/development.log` berisi `"password"=>"…"`. Tidak ada `filter_parameters` di `api/config/`. Nama kandidat (`candidate_name`) juga ikut tercatat di parameter request. | P1 | Kredensial dan data pribadi tersimpan di log, melanggar UU PDP. | Implementasikan | Selesai (belum di-commit) |
| F-10 | **Jawaban kandidat bisa hilang saat koneksi ke Gemini tersambung ulang.** Jenis: rusak di implementasi (PRD menjanjikan reconnect yang transparan). Layanan: api (realtime). Bukti ✅: di session 9 terjadi `reconnecting` saat kandidat menjawab, dan jawaban ±30 detik itu tidak ada di `transcript_turns` (hanya 3 turn). Tidak ada penanda bahwa ada jawaban yang hilang. | P1 | Kandidat dinilai tanpa jawabannya sendiri. | Ditunda. Eskalasi ke TL karena akar masalah realtime belum diketahui. Mitigasi kecil (menandai sesi yang terdampak) dipertimbangkan setelah scope utama. | Backlog |
| F-11 | **Kandidat diberi tahu wawancara selesai padahal gagal, dan tidak ada notice atau consent.** Jenis: belum didefinisikan. Layanan: web. Bukti ✅: error fatal berujung ke layar ✅ "Interview Complete — The interview has been recorded". Layar kandidat hanya berbahasa Inggris, dan tidak menjelaskan bahwa AI yang mewawancarai, bahwa audio dikirim ke Google, ataupun hak kandidat sesuai UU PDP. | P1 | Kandidat tidak tahu nasib wawancaranya, dan hak-haknya tidak disampaikan. | Ditunda. Eskalasi: siapa pengendali data dan apa isi notice harus diputuskan dulu. | Backlog |
| F-12 | **Coverage live berhenti tanpa peringatan saat model analisis gagal.** Jenis: belum didefinisikan. Layanan: api + web. Bukti ✅: model FLASH 404 membuat semua skill tetap `not_yet`, wawancara tidak bisa menutup otomatis, dan error hanya muncul di log server. | P1 | Assessor yang memantau live mengira kandidat belum menyentuh skill apa pun. | Ditunda (pola error-nya akan sama dengan F-08) | Backlog |
| F-13 | **Skill kembar di assessment membuat kandidat terjebak di "Briefly reconnecting", lalu link undangannya hangus.** Jenis: rusak di implementasi. Layanan: api + web. Bukti ✅: unique index `coverage_maps(session_id, skill_label)` gagal, WebSocket ditutup tanpa pesan, browser reconnect tanpa henti, dan setelah 120 detik sesi diakhiri sebagai `error` padahal belum pernah mulai. | P1 | Kandidat tidak pernah bisa mulai wawancara, dan undangannya terbuang. | Sudah diperbaiki: validasi label unik, error non-recoverable, client berhenti reconnect, grace timer hanya untuk sesi aktif | Selesai (belum di-commit) |
| F-14 | **Model Gemini yang dikonfigurasi sudah tidak tersedia atau terlalu lambat, dan respons JSON hanya dibaca sebagian.** Jenis: rusak di implementasi. Layanan: api. Bukti ✅: `gemini-2.5-flash-lite` mengembalikan 404 ("no longer available"). `gemini-3.8-flash` makan waktu 151 detik sampai timeout. `HttpClient` hanya membaca `parts[0]`, sehingga JSON kadang terpotong. | P1 | Coverage dan portfolio tidak pernah jadi. | Sudah diperbaiki: model diganti, client meminta `application/json`, semua part digabung, `MAX_TOKENS` jadi error eksplisit | Selesai (belum di-commit) |
| F-15 | **Override bisa disimpan tanpa alasan.** Jenis: belum didefinisikan. Layanan: api + web. Bukti 🔍: `assessor_notes` opsional (`assessor_override.rb`), dan form override tidak mewajibkan catatan. | P2 | Tidak ada jejak kenapa nilai AI diubah, sehingga keputusan sulit dibela kalau kandidat keberatan. | Implementasikan (catatan wajib) | Selesai (belum di-commit) |
| F-16 | **Confidence berubah-ubah untuk transkrip yang sama, dan confidence AI tetap tampil setelah di-override.** Jenis: belum didefinisikan. Layanan: api + web. Bukti ✅: dari transkrip yang sama, level tetap 3, tapi confidence berubah dari `medium` ke `low` antar-run. Fit/gap tetap menampilkan `confidence: low` setelah override ke L4. | P2 | Pembaca bingung angka mana yang bisa dipegang. | Sebagian: setelah override, sumber level ditampilkan sebagai "assessor". Kalibrasi confidence ditunda. | Selesai sebagian (belum di-commit) |
| F-17 | **Ambang tes internet 8/4 Mbps menolak koneksi seluler yang umum di Indonesia.** Jenis: belum didefinisikan. Layanan: web. Bukti 🔍: `internetSpeedTest.ts:19-23`, sementara audio sesi hanya butuh ±256 kbps. | P2 | Kandidat di luar kota besar tertolak sebelum sempat mulai. | Ditunda | Backlog |
| F-18 | **Menghapus skill di halaman Edit Assessment mungkin tidak menghapus di server.** Jenis: rusak di implementasi. Layanan: web. Bukti 🔍: `_destroy` tidak dikirim. | P2 | Assessment berisi skill yang dikira sudah dihapus. | Ditunda (perlu dibuktikan dulu) | Backlog |
| F-19 | **Puma cluster mode crash terus-menerus di macOS saat development.** Jenis: rusak di implementasi (developer experience). Layanan: api. Bukti ✅: `objc … fork() was called … Crashing instead`, worker di-respawn tanpa henti, dan request mendapat balasan kosong. | P2 | Developer mengira aplikasinya rusak. | Sudah diperbaiki: development default single mode | Selesai (belum di-commit) |
| F-20 | **Link undangan kandidat mengarah ke API, bukan ke web.** Jenis: rusak di implementasi (nilai default salah). Layanan: api. Bukti ✅: default `APP_BASE_URL` adalah `:3001`, sehingga muncul `No route matches [GET] "/interview/<token>"`. | P3 | Link undangan gagal dibuka di setup lokal. | Sudah diperbaiki: default di `Session#invite_url` | Selesai (belum di-commit) |
| F-21 | **Nama model default di kode dan sample sudah usang (`gemini-2.0-*`), dan README API tidak sesuai kenyataan.** Jenis: rusak di implementasi. Layanan: api. Bukti ✅. | P3 | Setup awal gagal tanpa petunjuk yang jelas. | README sudah ditulis ulang. Default model ditunda. | Sebagian selesai |
| F-22 | **Catatan coverage dari LLM tidak konsisten dengan angkanya.** Jenis: belum didefinisikan. Layanan: api. Bukti ✅: teksnya bilang "probe_count is 2", padahal nilai yang tersimpan 1. | P3 | Membingungkan saat memantau live. | Ditunda | Backlog |

## 4. Constraint signal: yang akan saya angkat ke Tech Lead

1. **Data model tidak bisa menyimpan "belum dinilai".**
   - `portfolio_skills.ai_level`, `portfolio_skills.ai_confidence`, dan `assessor_overrides.ai_level` semuanya `NOT NULL`, dengan `CHECK 1..5` untuk level.
   - Memperbaikinya butuh migrasi di database yang **dipakai bersama `rakamin-api`** (schema `ai_interview`). Migrasinya harus bisa dibalik dan aman untuk data yang sudah ada.
2. **Isolasi tenant tidak konsisten.** Scope otomatis hanya ada di `Assessment`, `Session`, dan `Vacancy`, sedangkan `Portfolio`, `PortfolioSkill`, `FitGapReport`, `CoverageMap`, dan `TranscriptTurn` bergantung pada kedisiplinan tiap controller.
3. **UU PDP belum punya pemilik keputusan.** Pertanyaan yang belum terjawab:
   - Siapa pengendali data, perusahaan klien atau Rakamin?
   - Apa dasar pemrosesan data kandidat?
   - Apa isi notice untuk kandidat?
   - Berapa lama transkrip disimpan?
   - Bagaimana transfer data ke Google (Gemini) dicatat?
4. **Ketergantungan ke Gemini rapuh.** Nama model berubah dan mengembalikan 404, 503 sering muncul, latensi model besar tidak bisa diprediksi, dan tidak ada pinning atau pemantauan.
5. **Realtime.** Audio kandidat bisa hilang saat sambungan ulang (F-10), dan akar masalahnya belum diketahui.
6. **Belum ada test, harness, maupun CI.** Semua jaring pengaman harus dibangun dulu sebelum perubahan bisa dibuktikan.
7. **Ada ambiguitas produk.** Bolehkah hasil AI menjadi satu-satunya dasar penolakan kandidat? PRD tidak menjawab. Revamp ini mengasumsikan **tidak boleh**: AI memberi rekomendasi, manusia yang memutuskan.

## 5. Arah revamp yang dipilih

**Target: setiap angka yang dilihat pengguna punya status yang jujur dan bisa ditelusuri ke buktinya.** Scope eksekusi mencakup F-01 sampai F-09, F-15, dan sebagian F-16. Tiga opsi yang dibandingkan:

| Opsi | Isi | Yang didapat | Ongkos dan risiko |
|---|---|---|---|
| **A, dipilih** | Status penilaian eksplisit di data model, aturan pasti dari coverage dan bukti yang mengalahkan klaim LLM, validasi output LLM, override yang bertahan, job idempoten, laporan dengan penanda basi, scoping tenant, dan revamp layar Portfolio serta Fit/Gap | DB, API, export, dan UI semuanya jujur. Bisa dites per kasus. | Perlu migrasi di DB bersama. Perubahan menyentuh beberapa service. |
| B | Hanya memperbaiki tampilan: menebak "tidak dinilai" dari `ai_level=1` dan bukti kosong | Murah dan cepat, tanpa migrasi | DB, export JSON, dan ATS tetap berisi L1. Tebakan bisa salah untuk L1 yang asli. Utang teknisnya bertambah. |
| C | Hanya memperbaiki prompt: LLM mengembalikan `null` untuk skill yang tidak dinilai | Perubahan paling kecil | Bergantung pada kepatuhan LLM yang terbukti tidak stabil, dan tetap butuh migrasi supaya `null` bisa disimpan |

Perbandingan lengkap (dampak vs ongkos, maintainability, failure mode, kecocokan dengan konteks) ditulis di dokumen Step 4.

## 6. Acceptance criteria (draf)

Aturannya:
- Setiap kriteria punya ID. Setiap ID harus punya minimal satu test atau langkah E2E yang membuktikannya (lihat bagian 6.6).
- Kalau implementasi butuh perilaku yang tidak tertulis di sini, tambahkan dulu di sini.

### 6.1 Kontrak data

**AC-D1.** `portfolio_skills` mendapat tiga kolom baru:
- `assessment_status`, enum dengan nilai `assessed`, `insufficient_evidence`, dan `not_assessed`;
- `status_reason` (string, boleh kosong), dengan nilai `not_covered`, `no_valid_evidence`, `missing_from_model_output`, atau `invalid_model_output`;
- `legacy_ai_level` (integer, boleh kosong), khusus untuk menyimpan nilai lama saat migrasi (AC-D4 dan AC-D5).

**AC-D2.** Kolom yang boleh kosong khusus untuk `not_assessed`: `ai_level`, `ai_confidence`, dan `competency_summary`. Untuk dua status lainnya, ketiganya tetap wajib diisi, dan level tetap harus di rentang 1..5. Aturan ini dijaga oleh validasi model sekaligus check constraint di DB.

**AC-D3.** `assessor_overrides.ai_level` boleh kosong, supaya assessor bisa memberi nilai manual untuk skill yang tidak dinilai AI. `override_level` tetap wajib di rentang 1..5. `assessor_notes` wajib diisi, tidak boleh hanya spasi, dan maksimal 2.000 karakter.

**AC-D4.** Migrasi `up` aman untuk data yang sudah ada.
- Setiap baris lama diklasifikasi ulang dengan aturan di AC-G1, memakai `coverage_maps` sesi yang sama.
- Baris yang menjadi `not_assessed` dikosongkan `ai_level`-nya, dan nilai lama disimpan di `legacy_ai_level` supaya migrasi bisa dibalik.

**AC-D5.** Migrasi `down` mengembalikan constraint lama tanpa error. Baris `not_assessed` diisi dari `legacy_ai_level` (atau 1 kalau kosong) dan confidence `low`.

**AC-D6.** `fit_gap_reports` mendapat dua kolom baru: `narrative_status` (`generated`, `skipped`, atau `failed`) dan `source_fingerprint` (string). `source_fingerprint` adalah hash dari:
- `portfolios.generated_at`,
- id dan waktu ubah semua override milik portfolio,
- `vacancies.updated_at`,
- daftar (`skill_label`, `expected_level`) vacancy.

Kunci JSON lama `expected_level` di `skill_comparisons` diganti menjadi `required_level` oleh migrasi data yang bisa dibalik.

### 6.2 Pembuatan portfolio (backend)

**AC-G1. Klasifikasi pasti.** Klasifikasi dijalankan setelah output LLM dibaca. Untuk setiap skill yang dikonfigurasi:
- `not_assessed` (alasan `not_covered`): tidak ada `coverage_maps` untuk skill itu, state-nya `not_yet`, atau `probe_count = 0`.
- `not_assessed` (alasan `no_valid_evidence`): tidak ada satu pun kutipan valid (AC-G3).
- `insufficient_evidence`: state `initiated`, atau `probe_count < 2`, atau hanya ada 1 kutipan valid. Level dari LLM tetap dipakai, tapi confidence dipaksa `low`.
- `assessed`: state `partial` atau `covered`, `probe_count ≥ 2`, dan minimal 2 kutipan valid.
- Klasifikasi selalu menang atas klaim LLM. Kalau LLM memberi level 3 untuk skill `not_covered`, level yang disimpan tetap kosong.

**AC-G2. Validasi output LLM.**
- Level yang diterima hanya integer 1..5, atau string angka `"1"` sampai `"5"`.
- Nilai lain diperlakukan sebagai tidak ada, menghasilkan `not_assessed` dengan alasan `invalid_model_output`. Contohnya: `null`, `0`, `6`, `-1`, `3.5`, `"L3"`, `"N/A"`, array, objek.
- Skill yang tidak muncul di output LLM menjadi `not_assessed` dengan alasan `missing_from_model_output`.
- Skill dari LLM yang tidak dikonfigurasi dan bukan discovered skill diabaikan, dan hanya labelnya yang dicatat di log.
- Kalau satu skill muncul lebih dari sekali di output, kemunculan pertama yang dipakai.
- Confidence di luar `high`, `medium`, dan `low` dianggap `low`.

**AC-G3. Kutipan harus benar-benar ada.**
- Sebuah kutipan valid jika, setelah dinormalisasi, muncul sebagai substring dari turn **kandidat** di `transcript_turns` sesi yang sama. Normalisasi: huruf kecil, spasi dirapatkan, tanda baca di awal dan akhir dibuang.
- Kutipan dari turn AI, kutipan yang tidak ditemukan, dan kutipan duplikat dibuang.
- Maksimal 3 kutipan per skill, sesuai urutan dari LLM.

**AC-G4. Override tidak pernah hilang karena regenerasi.**
- Baris `portfolio_skills` diperbarui di tempat. Kuncinya `skill_id` kalau ada, kalau tidak `skill_label` (tidak peka huruf besar-kecil).
- Baris yang skill-nya sudah tidak ada hanya dihapus kalau tidak punya override. Kalau punya override, barisnya disimpan dengan status `not_assessed`.
- Setelah regenerasi, setiap override lama masih ada, beserta `override_level`, catatan, pembuat, dan waktunya.

**AC-G5. Satu proses pada satu waktu.**
- Pembuatan portfolio mengambil row lock pada `portfolios`.
- Job kedua yang datang saat status masih `generating` keluar tanpa mengubah data dan mencatat `skipped_duplicate`.
- Endpoint regenerasi mengembalikan 409 kalau proses masih berjalan.

**AC-G6. Tidak ada tulisan setengah jalan.**
- Semua perubahan skill dan status ditulis dalam satu transaksi.
- Kalau model gagal di tengah, hasil `complete` sebelumnya tetap utuh.
- `generation_status` menjadi `failed` hanya kalau belum pernah ada hasil `complete`. Kalau sudah pernah ada, status tetap `complete`, hasil lama tetap ditampilkan, dan `generation_error` berisi kode kegagalan regenerasi terakhir. Kode itu dikosongkan lagi saat regenerasi berikutnya berhasil.

**AC-G7. Kegagalan model punya kode yang jelas.** Isi `generation_error` hanya salah satu kode berikut, tanpa isi respons mentah, transkrip, atau kutipan:

| Kondisi | Kode |
|---|---|
| Timeout | `model_timeout` |
| 429 atau 5xx setelah retry | `model_unavailable` |
| 404 (model tidak ada) | `model_not_found` |
| JSON tidak bisa dibaca | `invalid_model_output` |
| Respons terpotong (`MAX_TOKENS`) | `model_output_truncated` |

Sidekiq mencoba ulang maksimal 3 kali, dan setelah itu status final ditulis.

### 6.3 Fit/gap (backend)

**AC-F1. Hasil per skill vacancy.**
- `match`, `gap`, atau `exceed` hanya dihitung kalau ada level efektif dan statusnya `assessed` atau `insufficient_evidence`.
- Skill vacancy yang ada di assessment tapi `not_assessed` menghasilkan `not_assessed`, dengan `candidate_level: null` dan `delta: null`.
- Skill vacancy yang tidak ada di assessment sama sekali menghasilkan `not_assessed` dengan `reason: "not_in_interview"`.

**AC-F2. Level efektif.** Kalau ada override, level efektifnya `override_level`, dengan `level_source: "assessor"` dan `is_override: true`. Kalau tidak, level efektifnya `ai_level`, dengan `level_source: "ai"`. Override atas skill `not_assessed` membuat skill itu ikut dihitung.

**AC-F3. Hasil sementara.** Skill `insufficient_evidence` (dan tidak di-override) diberi `tentative: true`.

**AC-F4. Kontrak payload, sumber kebenaran untuk web.**
- Setiap elemen `skill_comparisons` berisi persis: `skill_label`, `skill_id`, `required_level`, `candidate_level`, `level_source`, `is_override`, `assessment_status`, `result`, `reason`, `delta`, `tentative`, dan `confidence`. `expected_level` tidak dikirim lagi.
- Di level report, selain field yang sudah ada, ada tambahan `narrative_status` dan `stale`.
- Di portfolio, setiap skill menambahkan `assessment_status` dan `status_reason`. Data sesi yang dibutuhkan AC-W3 juga ikut dikirim: `duration_seconds`, `time_limit_min`, dan `end_reason`.

**AC-F5. Narasi tidak boleh menyimpulkan dari ketiadaan bukti.**
- Prompt narasi hanya menerima skill dengan level efektif. Skill `not_assessed` disebut sebagai "tidak dinilai, jangan disimpulkan".
- Kalau tidak ada skill yang dinilai, narasi tidak dibuat sama sekali (`overall_narrative: null`, `narrative_status: "skipped"`).
- Kalau model gagal, perbandingan skill tetap tersimpan dan tampil, dengan `narrative_status: "failed"`.

**AC-F6. Laporan basi terdeteksi.** `GET /portfolios/:id/fitgap/:vacancy_id` mengirim `stale: true` kalau `source_fingerprint` sekarang berbeda dari yang tersimpan. Contohnya setelah override dibuat atau dihapus, setelah portfolio dibuat ulang, atau setelah vacancy diubah.

### 6.4 Keamanan dan data pribadi (backend)

**AC-S1. Endpoint berikut mengembalikan 404 untuk tenant lain:**
- `GET /sessions/:id/portfolio` dan `POST /sessions/:id/portfolio/regenerate`;
- `POST /portfolios/:id/fitgap`, `POST /portfolios/:id/regenerate_fitgap`, `GET /portfolios/:id/fitgap/:vacancy_id`, dan `GET /portfolios/:id/export`;
- `POST /portfolio_skills/:id/override`.

Status yang dipakai 404, bukan 403, supaya keberadaan datanya tidak bocor. Vacancy dari tenant lain juga 404.

**AC-S2. Validasi input.**
- `override_level` harus integer 1..5, selain itu 422. `assessor_notes` wajib diisi, selain itu 422.
- `vacancy_id` harus integer milik tenant, selain itu 404 atau 422.
- `format` export hanya `pdf` atau `json`.

**AC-S3. Log bebas data sensitif.**
- `filter_parameters` mencakup `passw`, `token`, `secret`, `_key`, `candidate_name`, `assessor_notes`, dan `text`.
- Log aplikasi baru tidak boleh berisi isi transkrip, kutipan, atau nama kandidat. Dibuktikan oleh spec yang menangkap output log.

### 6.5 Layar Portfolio dan Fit/Gap (frontend)

**AC-W1. Kartu skill mengikuti `assessment_status`.**
- `assessed`: badge level L1–L5 dengan label, confidence, kutipan, dan ringkasan.
- `insufficient_evidence`: badge level berlabel "Sementara", plus penjelasan bahwa bukti masih tipis (jumlah probe dan kutipan).
- `not_assessed`: **tidak ada angka level**. Badge netral (bukan merah) bertuliskan "Belum dinilai", disertai alasan yang mudah dibaca:
  - `not_covered`: "Tidak sempat dibahas di sesi ini"
  - `no_valid_evidence`: "Tidak ada kutipan yang bisa diverifikasi"
  - `invalid_model_output` atau `missing_from_model_output`: "Sistem gagal membaca hasil penilaian"

  Kartu ini juga punya tombol "Beri nilai manual".
- Status tidak boleh hanya dibedakan dengan warna; harus selalu ada teksnya.

**AC-W2. Override terlihat jelas.**
- Level dari assessor menjadi yang utama. Level AI tampil sekunder ("AI: L2" atau "AI: belum dinilai"), lengkap dengan catatan, nama atau ID pembuat, dan waktu.
- Form override mewajibkan catatan dan menampilkan error validasi dari API.

**AC-W3. Konteks sesi di atas portfolio:** durasi dibanding batas waktu, alasan sesi berakhir, dan ringkasan cakupan, misalnya "1 dari 3 skill dinilai". Contoh tampilannya: "Sesi berakhir oleh kandidat di menit ke-1 dari 10".

**AC-W4. Semua state portfolio punya tampilan sendiri.**
- `pending` atau `generating`: skeleton dan teks progres, polling setiap 4 detik yang berhenti saat `complete` atau `failed`. Lewat 4 menit, muncul pesan "lebih lama dari biasanya" dan polling tetap jalan.
- `failed`: pesan sesuai kode error dari AC-G7 dan tombol "Coba lagi" yang nonaktif saat proses berjalan. Kalau API mengembalikan 409, yang ditampilkan "sedang diproses".
- Regenerasi gagal tapi ada hasil lama (`generation_status: complete` dan `generation_error` terisi): hasil lama tetap tampil, dengan banner peringatan berisi pesan kode error.
- Error jaringan atau 500: error state dan tombol coba lagi. 404: "Data tidak ditemukan".

**AC-W5. Tabel fit/gap.**
- Kolom Required selalu terisi dari `required_level`.
- Kolom Kandidat berisi level atau "Belum dinilai".
- Chip hasil: Match, Gap, Exceed, Belum dinilai, atau "Di luar sesi" (untuk `not_in_interview`).
- Penanda ✏ muncul untuk `is_override`, dengan tooltip catatan assessor. Hasil `tentative` diberi penanda "Sementara".
- Ringkasan hitungan menampilkan "Belum dinilai" secara terpisah, tidak dicampur dengan Gap.

**AC-W6. Laporan basi** (`stale: true`): banner "Laporan ini dibuat sebelum ada perubahan" dengan tombol buat ulang. Tabel lama tetap terlihat, tapi diberi tanda.

**AC-W7. Narasi.**
- `narrative_status: "skipped"`: "Narasi tidak dibuat karena belum ada skill yang dinilai."
- `narrative_status: "failed"`: "Narasi gagal dibuat". Tabel perbandingan tetap tampil.

**AC-W8. Teks panjang.**
- Ringkasan, kutipan, dan narasi di atas 600 karakter dipotong dengan tombol "Lihat selengkapnya".
- Label skill sampai 255 karakter membungkus ke baris berikutnya tanpa merusak layout.
- Teks Bahasa Indonesia, emoji, dan karakter non-Latin tampil benar, termasuk di PDF export.

**AC-W9. Responsif.** Di lebar 375 px tidak ada scroll horizontal di level halaman. Tabel fit/gap berubah menjadi kartu bertumpuk, atau tabelnya bisa di-scroll dengan kolom skill menempel.

**AC-W10. Empty state.** Portfolio tanpa skill dan tenant tanpa vacancy masing-masing punya tampilan kosong dengan ajakan yang jelas.

### 6.6 Testing dan end-to-end

**AC-T1. Harness dibangun dulu.**
- API: RSpec dengan `rails_helper`, database test, dan WebMock untuk semua panggilan Gemini. Tidak ada panggilan jaringan sungguhan.
- Web: Vitest dan Testing Library.
- Perintahnya: `bundle exec rspec` dan `pnpm test`.

**AC-T2. Spec backend minimal:**

| Area | Spec |
|---|---|
| Klasifikasi | Table-driven untuk semua kombinasi di AC-G1 |
| Validasi output LLM | Semua nilai di AC-G2 |
| Verifikasi kutipan | AC-G3 |
| Regenerasi | Override tetap ada (AC-G4) |
| Job | Ganda dan bersamaan (AC-G5) |
| Kegagalan model | Setiap kode di AC-G7, ditambah hasil lama tetap utuh (AC-G6) |
| Engine fit/gap | Setiap hasil, override, `tentative`, narasi `skipped`/`failed`, dan fingerprint basi |
| Request | Setiap endpoint di AC-S1 dengan token tenant lain menghasilkan 404, plus validasi AC-S2 |
| Migrasi | `up` lalu `down` lalu `up` di atas data contoh tanpa kehilangan nilai |
| Log | AC-S3 |

**AC-T3. Spec frontend minimal:**
- `SkillPortfolioCard` untuk setiap status dan untuk kondisi override;
- `ComparisonTable` untuk setiap hasil, kolom Required, penanda ✏, dan teks panjang;
- `PortfolioPage` untuk state generating, failed, partial, dan hasil lama dengan banner;
- `FitGapReportPage` untuk banner basi serta narasi `skipped` dan `failed`.

**AC-T4. Seeded fault.** Di branch percobaan, logika klasifikasi sengaja dirusak (misalnya `not_yet` dianggap `assessed`). Spec harus gagal, dan perubahannya di-revert dengan riwayat commit yang terlihat.

**AC-T5. Skenario end-to-end.** Dijalankan manual dan direkam untuk video, dengan script WebSocket yang sama seperti saat menemukan masalah:

| Skenario | Langkah | Hasil yang diharapkan |
|---|---|---|
| E2E-1 Sesi parsial | 3 skill, kandidat hanya membahas 1, sesi diakhiri lebih awal | DB: 1 skill `assessed` atau `insufficient_evidence`, 2 skill `not_assessed` dengan `ai_level` kosong. API: field status ada. UI: "Belum dinilai" tanpa angka. Fit/gap: 2 skill "Belum dinilai", bukan Gap. Narasi tidak menyebut skill itu sebagai kekurangan. |
| E2E-2 Override bertahan | Beri nilai manual pada skill yang belum dinilai, lalu buat ulang portfolio | Override tetap ada. Fit/gap menampilkan ✏ dan menandai laporan lama sebagai basi. |
| E2E-3 Model gagal | Nama model diset ke yang tidak ada | Portfolio `failed` dengan pesan "model tidak tersedia" dan tombol coba lagi. Setelah model diperbaiki dan dicoba lagi, hasilnya muncul. |
| E2E-4 Tenant lain | Token organisasi kedua | 404 di semua endpoint AC-S1. Organisasi uji dihapus setelahnya. |
| E2E-5 Teks panjang dan mobile | Ringkasan 5.000 karakter, label 255 karakter, lebar 375 px | Screenshot rapi, tanpa scroll horizontal. |

**AC-T6. Definition of done.**
- Semua spec hijau, dan `pnpm build` (tsc) lolos.
- Setiap AC di dokumen ini tercentang dengan link ke spec atau screenshot.
- Tidak ada secret atau data pribadi asli di commit.

## 7. Asumsi yang dipakai (karena tidak ada sesi tanya-jawab)

- Ambang klasifikasi di AC-G1 (2 probe, 2 kutipan) mengikuti definisi `covered` di PRD 01 ("bisa mempertahankan level dengan 2–3 kutipan"). Ini keputusan produk yang bisa disetel ulang dan dicatat di laporan.
- Hasil AI adalah rekomendasi, bukan keputusan akhir. UI selalu memberi jalan untuk penilaian manusia.
- Bahasa UI assessor mengikuti keputusan yang masih terbuka. Teks contoh di dokumen ini ditulis dalam Bahasa Indonesia untuk menjelaskan maksudnya.
- Status 404 (bukan 403) untuk akses lintas tenant, supaya keberadaan data tidak bisa ditebak.
