# Langkah 4 — Revamp Strategy, Acceptance Criteria & Trade-offs

## Tujuan dan batas keputusan

Dokumen ini menerjemahkan temuan Langkah 3 menjadi keputusan desain untuk Langkah 5. Fokus revamp:

1. Isolasi tenant dan otorisasi seluruh resource turunan.
2. Validasi bukti AI dan representasi skill yang belum dinilai.
3. Siklus hidup job fit-gap yang idempotent dan aman terhadap polling/worker paralel.
4. Kontrak API–UI eksplisit untuk nilai, status, kegagalan, dan override.

Scope mencakup backend dan frontend. Kriteria adalah kriteria turunan dari PRD, perilaku repo, dan risiko Langkah 2/3; belum merupakan persetujuan kebijakan hiring/legal. AI memberi rekomendasi berbasis bukti, assessor tetap meninjau hasil, dan skor tidak menjadi keputusan penolakan otomatis.

### Asumsi dan batas

- Skema saat ini belum memiliki membership user–organization yang dapat dipercaya. Opsi pilihan memerlukan membership eksplisit dengan role dan status aktif per organisasi. Header tenant hanya selector konteks di antara membership sah, bukan bukti otorisasi.
- User lama tidak boleh otomatis diberi akses ke semua tenant. Backfill harus memakai pemetaan organisasi yang diverifikasi; akun tanpa pemetaan gagal tertutup sampai administrator menetapkan aksesnya. Akun lokal/dev dapat diberi membership melalui seed yang jelas.
- Nama API kanonis untuk tingkat persyaratan adalah expected_level, karena itulah field yang sudah dikirim API. null berarti nilai memang tidak tersedia; field hilang atau tipe salah melanggar kontrak.
- Brief mencantumkan tenggat Rabu, 19 Agustus pukul 13.00 WIB. Tanggal itu sudah lewat dibanding tanggal kerja dokumen ini, 24 September 2026. Strategi mengutamakan slice yang dapat ditinjau dan menutup risiko inti; estimasi kalender perlu diperbarui.
- Audit Langkah 3 bersifat statis. Perilaku provider AI, infrastruktur produksi, retensi vendor, dan pemetaan tenant produksi masih perlu diverifikasi.

## Strategi revamp yang diusulkan

Pilih **Option A — vertical slice evidence-first dengan penguatan batas kepercayaan**. Kerjakan tenant authorization pada API dan WebSocket, validasi hasil model sebelum persistence, status generation yang tersimpan dan dilindungi constraint database, lalu selaraskan payload API dan UI. Sertakan migrasi dan transisi data, bukan hanya patch komponen React.

### 1. Tenant sebagai batas akses terverifikasi

- Autentikasi menetapkan identitas user. Tenant aktif diambil dari membership aktif user dan role membership. X-Tenant-Scheme hanya selector; mismatch atau membership yang tidak ada ditolak.
- Semua lookup di-scope ke tenant, termasuk portfolio, portfolio skill, fit-gap report, override, ekspor, dan relasi turunannya. Tenant sesi diturunkan dari assessment induk; relasi tidak konsisten ditolak.
- Terapkan pemeriksaan role yang sama pada REST dan WebSocket assessor. Token kandidat adalah capability terpisah: terbatas pada satu sesi, dapat kedaluwarsa/dicabut, dan tidak memberi akses assessor.
- Lookup lintas tenant konsisten menghasilkan 404 atau 403 sesuai kebijakan endpoint, tanpa payload/metadata, enqueue job, mutasi, atau efek samping.
- Catat penolakan otorisasi tanpa transkrip, token penuh, atau data pribadi yang tidak perlu.

### 2. Penilaian AI berbasis bukti

- Gunakan output model terstruktur dan validasi di server sebelum menyimpan. Perlakukan transkrip kandidat sebagai data tak tepercaya, bukan instruksi.
- Setiap evidence mempunyai turn_id dan kutipan. Server memastikan turn ada di sesi/tenant yang sama, speaker adalah kandidat, kutipan cocok dengan teks sumber setelah normalisasi terdefinisi, dan skill termasuk rubrik assessment.
- Jangan clamp nilai di luar rentang menjadi nilai sah. Tolak nilai dengan tipe/format salah; jangan menyimpan skor tanpa bukti yang lolos.
- Bedakan assessed, not_assessed, dan kegagalan generation. Skill tanpa bukti cukup tetap tampak belum dinilai dengan level/confidence null; jangan jadikan level terendah.
- Evidence/rating invalid pada satu skill menjadi not_assessed dengan reason code aman. Kegagalan provider/format pada seluruh run menjadi failed, bukan portfolio baru yang tampak selesai.
- UI assessor menunjukkan evidence sumber, confidence dan status. Confidence rendah/hasil parsial meminta review manusia.

### 3. Fit-gap generation idempotent

- Buat record/status generation sebelum enqueue. Unique key database melindungi kombinasi portfolio, vacancy, dan revision input; locking/claim mencegah request serentak membuat job ganda.
- POST berulang dan polling GET mengacu ke generation yang sama. Status generating/failed eksplisit; 404 hanya berarti resource/generation tidak ditemukan.
- Worker aman diulang, tidak menimpa hasil revision terbaru, melakukan retry terbatas untuk gangguan sementara, dan menyimpan error code aman tanpa detail provider/PII.
- Saat refresh, pertahankan laporan valid sebelumnya sampai hasil baru berhasil. Override/perubahan input membuat revision baru dengan invalidasi yang terdefinisi.
- UI melakukan polling dengan backoff/batas retry, menampilkan state selesai/gagal/parsial, serta aksi coba lagi. Banyak tab tidak menambah biaya model.

### 4. Kontrak API–UI tunggal

Payload skill fit-gap sekurangnya memiliki makna dan tipe berikut; nama JSON harus sama pada serializer dan validator client:

    {
      "skill_id": "uuid",
      "assessment_status": "assessed",
      "candidate_level": 3,
      "expected_level": 4,
      "confidence": "medium",
      "evidence": [{ "turn_id": "uuid", "quote": "..." }],
      "is_override": false,
      "reason_code": null
    }

- assessment_status memakai enum kontrak, setidaknya assessed/not_assessed. Status generation portfolio/fit-gap berada pada objek generation tersendiri.
- candidate_level dan expected_level integer 1–5 atau null hanya bila kontrak mengizinkan. assessed mewajibkan candidate_level; not_assessed mewajibkan candidate_level null dan alasan. expected_level null tampil “belum ditentukan”, bukan 0/kosong.
- React memvalidasi respons saat runtime (Zod tersedia di web) dan menampilkan error kontrak yang dapat dipulihkan. Tidak ada coercion string angka, boolean menjadi angka, atau fallback yang menyamarkan payload rusak.
- Tabel membedakan match, gap, exceed, not_assessed; not_assessed tidak dihitung sebagai gap/match. Field override menunjukkan label dan nilai sebenarnya.
- Ringkasan, alasan, dan kutipan panjang dibungkus aman dan dapat dibuka penuh. Teks tidak dirender sebagai HTML.

## Acceptance criteria turunan

Kriteria berikut menjadi definisi selesai Langkah 5. Setiap butir menyatakan perilaku backend dan hasil yang terlihat pada UI bila berlaku.

### A. Autentikasi, tenant, dan batas data

1. Login menetapkan identitas tanpa mempercayai tenant dari header. Selector cocok membership aktif berarti konteks dipilih; selain itu request ditolak. Mengubah header setelah login tidak memperluas claim atau akses.
2. User tanpa membership aktif tidak melihat assessment, vacancy, sesi, portfolio, transkrip, fit-gap, ekspor, atau override tenant mana pun. Mengetahui tenant_scheme/ID tidak menciptakan membership.
3. ID resource tenant lain pada operasi read/write tidak memberi data, tidak mengubah record, tidak membuat job, dan tidak mengungkap nama/keberadaan resource. Berlaku pada resource induk/anak, ekspor, dan regenerate.
4. Relasi portfolio → session → assessment → tenant divalidasi konsisten. Relasi silang tenant atau orphan ditolak tanpa join data.
5. WebSocket assessor memerlukan user aktif, membership tenant cocok, role yang diizinkan, dan sesi tenant yang sama. Invite token kandidat hanya membuka sesi yang menjadi cakupannya.
6. Invite token memiliki expiry/revocation dan validasi status sesi. Token penuh tidak muncul di log, error, analytics, atau URL query tercatat server. Token kedaluwarsa/dicabut ditolak dan UI menjelaskan tautan tidak berlaku.
7. Pengujian otorisasi meliputi dua tenant, user satu/beberapa membership, role tidak berhak, resource turunan, REST, WebSocket, ekspor dan efek enqueue. Kebijakan 403/404 konsisten.

### B. Status assessment dan evidence

1. Setiap skill rubrik mempunyai status eksplisit. Skill yang tidak muncul, bukti kandidat tidak cukup, di luar scope, atau tidak dapat dinilai tidak mendapat level default: status not_assessed, level/confidence null, evidence kosong dan reason code relevan.
2. Skill hanya assessed bila memiliki sekurangnya **dua evidence terpisah dari giliran kandidat berbeda**, turn valid, kutipan relevan/cocok dengan sumber, dan analyzer tidak menyatakan bukti kurang. Probe count sendiri tidak pernah menaikkan coverage menjadi covered.
3. Evidence tersimpan hanya menunjuk giliran kandidat dari sesi sama. Kutipan dari giliran AI, sesi/tenant lain, sumber tak dikenal, kosong atau fabrikasi model tidak tersimpan sebagai evidence sah.
4. Rating adalah integer JSON 1–5. 0, 6, pecahan, string angka, boolean, string kosong, NaN/infinity dari adapter, nilai hilang pada skill assessed, dan ID skill di luar rubrik ditolak sebelum persistence. Tidak ada clamp atau nilai tebakan.
5. Confidence hanya enum yang didukung. Nilai tak dikenal tidak dipetakan diam-diam. Confidence diturunkan dari bukti/aturan terdefinisi, bukan probe count saja; confidence rendah/konflik meminta review manusia.
6. ID skill duplikat, field wajib hilang, JSON malformed/non-JSON, field bertentangan atau schema tak dikenal tidak membuat hasil parsial tampak sah. Validator gagal aman dan mencatat reason code. Kebijakan field tak dikenal (reject atau ignore) konsisten dan diuji.
7. Prompt menegaskan teks kandidat adalah data kutipan tak tepercaya dan tidak boleh mengubah tugas/rubrik. Validasi sumber tetap diterapkan bila model mengikuti instruksi di transkrip.
8. Bila satu skill invalid dan yang lain lolos, item invalid menjadi not_assessed; hasil valid lain hanya ditampilkan dengan label parsial dan kekurangan tidak disamarkan. Jika aturan bisnis belum menerima partial portfolio, seluruh run failed. Tidak boleh mengarang hasil.
9. Konflik transkrip, coverage, dan output model tidak otomatis diselesaikan menjadi level. Assessor melihat status perlu review dan bukti tersedia.

### C. Kegagalan model, antrean, dan data panjang

1. Timeout, rate limit, outage, koneksi putus, respons kosong, skema salah dan kegagalan simpan mempunyai state loading/gagal yang berbeda dari selesai. UI tidak menyatakan portfolio/laporan berhasil sebelum tersimpan.
2. Gangguan sementara dicoba ulang dengan batas dan backoff. Kegagalan permanen/format memberi error code aman, opsi retry generation baru terkontrol, dan tidak membuka prompt, transcript, credential, stack trace, atau pesan vendor mentah.
3. Retry worker idempotent: tidak menggandakan evidence, laporan, perubahan status, atau probe count. Job lama tidak menimpa revision baru.
4. Generation gagal tidak menghapus portfolio/fit-gap valid sebelumnya. UI membedakan hasil terakhir yang masih berlaku dari generation baru yang gagal/belum selesai.
5. POST fit-gap berulang karena polling, refresh, atau beberapa tab menghasilkan satu generation/job per revision input. GET saat proses mengembalikan generating, bukan 404; selesai memberi payload kontrak dan gagal memberi state serta aksi retry.
6. Polling berhenti pada state terminal, memakai interval/backoff terbatas, dan menampilkan pemulihan bila timeout UI tercapai. Banyak pembaca status tidak memanggil model.
7. Transkrip panjang tidak dipotong diam-diam sampai evidence terlepas dari sumber. Budget konteks/token terkonfigurasi; jika chunking/ringkasan dipakai, fakta/evidence tetap terhubung ke turn asal. Batas provider menghasilkan status gagal/parsial yang jelas, bukan skor palsu.
8. Kutipan, ringkasan dan error sangat panjang tidak merusak layout, kontrak atau log. Batas ukuran request/response terdokumentasi; batas terlampaui memberi respons validasi (misalnya 413/422) yang dapat dipahami UI. Input kosong, whitespace, Unicode/emoji, newline, teks berulang dan teks mirip instruksi tetap mempertahankan identitas sumber.
9. Level, ID, timestamp, enum, dan field optional mempertahankan tipe pada JSON dan TypeScript. null dibedakan dari field hilang.

### D. Fit-gap, override, keputusan assessor

1. expected_level tampil pada kolom persyaratan; candidate_level hanya tampil jika assessed; override memiliki is_override, level akhir dan penanda sumber nilai.
2. Perbandingan untuk assessed dihitung deterministik. not_assessed tidak diberi label gap/match/exceed, tidak masuk agregasi seolah level 0, dan tampil “belum dinilai”.
3. expected_level null tampil “belum ditentukan”; tipe salah tidak diformat diam-diam. Level di luar rentang ditolak di server dan UI.
4. Override tidak mengubah evidence AI retroaktif. UI membedakan nilai AI dan keputusan assessor; alasan diwajibkan dan setiap perubahan meninggalkan jejak siapa/kapan/nilai sebelum-sesudah.
5. Narasi rekomendasi tidak menyatakan keputusan hiring final dan menunjukkan keterbatasan saat bukti belum dinilai, confidence rendah, atau input vacancy tidak lengkap.

### E. Hak data dan sinyal PDP

1. Sebelum akses mikrofon/pengumpulan data, kandidat menerima notice berisi tujuan, kategori data, penerima/pemroses AI, retensi, kontak pengendali, hak dan jalur keberatan/bantuan berdasarkan dasar pemrosesan yang ditetapkan organisasi. Catatan persetujuan dibuat hanya bila consent adalah basis yang dipilih.
2. UI kandidat secara akurat menyatakan wawancara gagal, berlangsung, selesai atau tidak terekam. Cara meminta review/koreksi dan bantuan dapat ditemukan.
3. Tetapkan owner/tujuan/retensi serta mekanisme pencarian/penghapusan agar transkrip, evidence, score, log, cache dan salinan worker ditangani dalam satu siklus. Retensi final, dasar pemrosesan, wilayah Gemini, transfer lintas negara, DPIA dan penunjukan fungsi PDP memerlukan keputusan pengendali/legal; implementasi teknis tidak mengarang jawabannya.

Kriteria PDP adalah kontrol produk awal, bukan kesimpulan kepatuhan hukum. Rujukan Langkah 2/3: [UU No. 27 Tahun 2022, JDIH Komdigi](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/) (terutama Pasal 10, 20–22, 30–39, dan 56). Pengendali/legal menilai kewajiban menurut pemrosesan produksi dan kontrak vendor.

## Pilihan arsitektur dan trade-off

Biaya relatif: rendah/sedang/tinggi.

| Dimensi | Option A — Vertical slice evidence-first **(dipilih)** | Option B — Patch cepat per gejala | Option C — Platform penilaian auditable |
|---|---|---|---|
| Bentuk | Membership tenant eksplisit + scoped policy/service; schema/status evidence portfolio; generation fit-gap tersimpan/unik; kontrak response + validator runtime UI. Migrasi per bagian dengan fail-closed. | Kondisi ad hoc di controller, pemeriksaan quote sederhana, debounce/flag React, mapping field manual. | Tenant ID/membership konsisten seluruh domain; platform policy; event/outbox/job ledger; versi run/evidence immutable; schema AI, kalibrasi, review/appeal dan audit menyeluruh. |
| Product Impact vs Cost | **Tinggi pada risiko utama / sedang.** Melindungi data, hasil AI, biaya model dan state assessor; memerlukan migrasi serta koordinasi API/UI. | **Sedang / rendah.** Gejala layar membaik dan sebagian pemicu berkurang; risiko inti tetap terbuka di titik lain. | **Sangat tinggi / sangat tinggi.** Auditabilitas dan kendali terbaik; sulit masuk satu perubahan kecil. |
| Long-term Maintainability | **Baik.** Invariant di persistence/service/contract; dapat diperluas tanpa framework generik baru. | **Rendah.** Aturan terduplikasi; race lintas tab/server dan kontrak implisit bertahan. | **Sangat baik bila dikelola.** Konsistensi skala besar, namun komponen, operasi, dan beban upgrade bertambah. |
| Failure modes di bawah tekanan | Constraint unik/locking mengendalikan request bersamaan; retry idempotent; hasil lama dipertahankan; evidence invalid menjadi not_assessed. Risiko tersisa: migrasi/backfill atau ambang bukti terlalu ketat dapat menolak akses/meningkatkan item unassessed. | Debounce hilang pada banyak tab/client atau retry jaringan; worker paralel tetap membuat job ganda. Pemeriksaan kutipan sederhana rapuh terhadap normalisasi/teks panjang; endpoint terlupa dapat membocorkan tenant. | Outbox lag, policy service unavailable, migrasi luas, operasi event/audit menjadi failure baru. Perubahan besar yang belum matang dapat memblokir alur inti. |
| Contextual fit | **Paling sesuai.** Rails/ActiveRecord, Sidekiq, React dan Zod mendukung tanpa layanan baru. Dapat dipecah menjadi perubahan yang direview. Tenggat brief sudah lewat; estimasi perlu disegarkan. | Hanya cocok sebagai mitigasi darurat sementara jika harus menghentikan gejala seketika; tidak cukup sebagai revamp. | Cocok sebagai roadmap setelah alur dasar aman dan kebutuhan audit ditetapkan. Perlu estimasi, keputusan produk dan kapasitas operasi. |

### Keputusan

**Implementasikan Option A pada Langkah 5.** Ini menurunkan risiko P1 terbesar dalam codebase sekarang: membership dan query scope menjadi otoritas backend; validasi evidence terjadi sebelum persistence; status/constraint DB melindungi generation fit-gap; validator UI menjaga kontrak. Option B tidak cukup karena keamanan dan idempotency tidak boleh bergantung pada satu browser. Option C tetap arah jangka panjang, tetapi menambah sistem dan biaya migrasi yang belum diperlukan untuk menutup masalah prioritas.

### Urutan implementasi Langkah 5

1. Tutup tenant boundary: membership/role, pemilihan tenant, scope semua resource turunan, REST dan WebSocket. Verifikasi pemetaan user lama sebelum enforcement dibuka.
2. Tegaskan status assessment: migrasi status per skill dan nilai nullable untuk not_assessed; hapus promosi coverage oleh probe count; validasi hasil model/evidence sebelum tulis.
3. Jadikan fit-gap idempotent: status sebelum enqueue, unique key/revision, worker retry aman, GET status dan POST idempotent.
4. Selaraskan API–UI: serializer sebagai kontrak kanonis, validator runtime/tipe TS, state loading/partial/not-assessed/failed/retry, expected_level dan override konsisten.
5. Tambahkan hardening P2 terkait: redaksi resumption handle/token, expiry/revocation invite, state error kandidat yang jujur, dan audit trail override.
6. Verifikasi kriteria dengan skenario dua tenant dan resource lintas tenant, output model valid/invalid, job bersamaan/retry, serta kontrak payload termasuk null, tipe salah dan teks panjang. Perluas harness secukupnya untuk melindungi alur kritis; jangan memperluas scope menjadi refactor tes menyeluruh.

## Constraint Signal — eskalasi

| Sinyal | Pemilik keputusan | Dampak bila belum diputuskan |
|---|---|---|
| **P1 — Membership dan role tenant belum ada.** Diperlukan model membership dan pemetaan sah user lama; header bukan otoritas. | Tech Lead + owner tenant/operasi | Backfill dapat memberi akses berlebihan atau mengunci assessor sah. Jangan deploy enforcement sebelum peta akses diverifikasi. |
| **P1 — not_assessed mengubah kontrak data.** Saat ini ai_level diwajibkan 1–5 dan fit-gap mengharapkan angka. | Tech Lead + Product | Tanpa migrasi nullable/status terkoordinasi, API dan UI memberi arti berbeda atau gagal pada data lama. Skor lama hanya dimigrasikan sebagai assessed bila memang tersimpan sebagai skor; probe count historis tidak cukup untuk menyimpulkan status. |
| **P1 — Ambang dua giliran kandidat adalah usulan konservatif.** PRD meminta evidence yang dapat dipertanggungjawabkan tetapi tidak menetapkan formula penuh. | Product/domain owner + Tech Lead + assessor representative | Ambang tinggi menambah not_assessed; ambang rendah mengurangi reliabilitas. Validasi dengan rubrik dan contoh sintetis sebelum menjadi kebijakan hiring. |
| **P1 — UU PDP dan keputusan kerja.** Peran Pengendali/Prosesor, dasar, notice, retensi, hak, DPIA, wilayah/kontrak Gemini, transfer lintas negara dan automasi keputusan tidak dapat diputuskan dari kode. | Product owner/pengendali + Legal/privasi | Implementasi tanpa keputusan tujuan/retensi/vendor dapat tetap tidak transparan atau tak tertangani. |
| **P2 — Override dan human review.** Nilai tunggal terkini tidak merekonstruksi keputusan; reviewer dan jalur keberatan belum ditetapkan. | Product + assessor lead + Legal | Rekomendasi dapat diperlakukan sebagai keputusan final tanpa akuntabilitas/jalur koreksi. |
| **P2 — Panjang transkrip dan biaya provider.** Budget konteks, chunking, durasi, batas output/evidence belum ditetapkan. | Tech Lead + AI owner | Truncation dapat memutus evidence dari sumber; tanpa batas terukur run panjang dapat gagal atau boros. |
| **P2 — Timeline brief stale.** Tenggat 19 Agustus 2026 telah lewat pada 24 September 2026. | Project owner | Scope Option A tetap jelas, tetapi tanggal rilis/estimasi perlu diperbarui sebelum menjadi komitmen delivery. |

## Definisi selesai Langkah 4

- Opsi dibandingkan pada empat dimensi yang diminta dan satu opsi dipilih dengan alasan.
- Acceptance criteria meliputi backend, UI, edge cases, kegagalan AI/worker, concurrency, tipe data dan teks panjang.
- Asumsi dipisahkan sebagai Constraint Signal dengan pemilik keputusan.
- Dokumen menjadi acuan Langkah 5; implementasi kode belum dilakukan pada Langkah 4.
