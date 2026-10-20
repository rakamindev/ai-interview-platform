# Pilar 5 — Kandidat (yang tidak memilih) & UU PDP

> Riset web 2026-10-19 (subagent). Nomor pasal UU PDP dicek terhadap salinan BPK/Hukumonline oleh subagent; info PP 33/2026 & status lembaga berasal dari sumber 2026 yang dikutip — **cek ulang ke teks resmi sebelum dipakai di dokumen keputusan**. Ini bukan nasihat hukum.
> Klaim repo = pembacaan kode statis (belum runtime). Gap ditandai `missing-spec` (tak pernah didefinisikan) atau `defective` (didefinisikan tapi rusak).

## Posisi kandidat
- Yang memilih alat ini perusahaan, bukan kandidat; menolak = kehilangan lowongan → consent "bebas" secara struktural lemah, butuh pengaman tambahan (jalur alternatif, review manusia, hak keberatan) `[INFERENCE]`.
- Taruhan: TPT Mei 2026 4,65% dari 155,41 jt angkatan kerja [BPS 2026](https://www.bps.go.id/id/pressrelease/2026/08/05/2606/tingkat-pengangguran-terbuka--tpt--sebesar-4-65-persen---rata-rata-upah-buruh-sebesar-3-39-juta-rupiah-.html); satu label "gap" yang salah bisa menutup satu siklus lamaran, dan kandidat tidak melihat hasil maupun punya saluran banding.
- Penerimaan AI: 66% warga AS tidak mau melamar ke pemberi kerja yang memakai AI dalam keputusan, 71% menolak AI memutuskan akhir [Pew 2023](https://www.pewresearch.org/internet/2023/04/20/americans-views-on-use-of-ai-in-hiring/); survei Indonesia `[UNVERIFIED]`.
- Konektivitas: persentil-10 mobile 5,69/2,0 Mbps, 41% penduduk perdesaan [Ookla](https://www.ookla.com/articles/indonesia-connectivity-divide-1h2025) — ambang produk 8/4 Mbps (`web/src/utils/internetSpeedTest.ts:19-23`) menutup lapisan terbawah.
- Bahasa & aksen: disparitas WER ASR antar kelompok penutur (0,35 vs 0,19) [PNAS 2020](https://www.pnas.org/doi/10.1073/pnas.1915768117); ASR Jawa/Sunda turun di kondisi bising [arXiv 2025](https://arxiv.org/abs/2509.25878); wawancara bahasa Inggris ikut menilai kefasihan, bukan hanya skill.
- Disabilitas: UU 8/2016 Pasal 11 (hak kerja tanpa diskriminasi + Akomodasi yang Layak), Pasal 53 kuota 1% swasta / 2% pemerintah-BUMN [BPK](https://peraturan.bpk.go.id/Download/26352/UU%20Nomor%208%20Tahun%202016.pdf); format suara-saja mengecualikan kandidat tunarungu/tunawicara `[INFERENCE]`.

## UU PDP (UU 27/2022) — yang relevan
Sumber utama: [salinan BPK](https://peraturan.bpk.go.id/Download/224884/UU%20Nomor%2027%20Tahun%202022.pdf), [teks Hukumonline](https://learning.hukumonline.com/wp-content/uploads/2023/07/Undang-Undang-No.27-Tahun-2022-Hukumonline.pdf).
- Berlaku 17 Okt 2022; masa penyesuaian berakhir **17 Okt 2024** (Pasal 74, 76).
- Data spesifik (Pasal 4(2)): kesehatan, **biometrik** (identifikasi unik), genetika, kejahatan, anak, keuangan. Suara untuk percakapan/ASR minimal data umum; menjadi spesifik bila dipakai untuk identifikasi unik (voiceprint) `[INFERENCE]`. Transkrip bisa memuat pengakuan kesehatan/disabilitas → data spesifik.
- Consent: sebelum minta consent wajib info legalitas, tujuan, jenis data, retensi, jangka waktu, hak subjek (Pasal 21(1)); tertulis/terekam, terbedakan jelas, **bahasa Indonesia** sederhana (Pasal 22, Penjelasan); tidak memenuhi syarat = batal demi hukum (22(5)).
- Hak subjek: info (5), koreksi (6), akses & salinan (7), hapus (8), tarik consent (9), **keberatan atas keputusan yang hanya berbasis pemrosesan otomatis termasuk profiling yang berdampak signifikan (10)** — Penjelasan menyebut profiling termasuk "riwayat pekerjaan… keandalan, perilaku"; tunda/batasi (11), ganti rugi (12), portabilitas (13).
- Kewajiban pengendali: prinsip Pasal 16(2) (terbatas, sah, transparan, **akurat & tidak menyesatkan**, aman, dihapus setelah retensi); **akurasi + kewajiban verifikasi (29)**; koreksi ≤3×24 jam (30); rekam pemrosesan (31); akses + rekam jejak ≤3×24 jam (32); keamanan & kerahasiaan (35–39); berhenti proses ≤3×24 jam setelah consent ditarik (40); hapus/musnahkan (42–45).
- Data anak butuh persetujuan wali (25); disabilitas lewat komunikasi cara tertentu (26).
- **DPIA wajib** untuk risiko tinggi (Pasal 34): keputusan otomatis berdampak signifikan, data spesifik, skala besar, **evaluasi/penskoran sistematis** (= level L1–L5), **pencocokan data** (= fit/gap), teknologi baru (LLM).
- **DPO** (Pasal 53) untuk pengendali & prosesor bila pemantauan sistematis skala besar / data spesifik skala besar; putusan MK 151/PUU-XXII/2024: satu pemicu cukup [BPK](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022).
- Kebocoran: notifikasi tertulis ≤3×24 jam ke subjek & lembaga (Pasal 46).
- **Transfer lintas batas** (Pasal 56, berjenjang: negara setara → pelindungan memadai mengikat → consent subjek). Relevan: audio & transkrip dikirim ke Google Gemini.
- Prosesor wajib ikut perintah pengendali; sub-prosesor (Google) butuh persetujuan **tertulis** pengendali (Pasal 51(5)). Rakamin kemungkinan prosesor bagi perusahaan klien `[INFERENCE]`.
- Sanksi: administratif s.d. denda 2% pendapatan tahunan (Pasal 57); pidana Pasal 67 (≤5 th / Rp5 M), korporasi s.d. 10× (Pasal 70).
- Status 2026 (sumber sekunder): **PP 33/2026** diundangkan 16 Jul 2026, berlaku 16 Jan 2027; Pasal 94–96 mengatur mekanisme keberatan Pasal 10 (wajib alternatif dengan campur tangan manusia), Pasal 120–121 DPIA **sebelum** pemrosesan, Pasal 32–33 consent "bebas, sadar, spesifik, tidak ambigu" + info sebelum consent [salinan PP](https://static.banyumaskab.go.id/website/file/peraturan_pemerintah_no._33_tahun_2026_100926115902.pdf), [Kompas 2026](https://nasional.kompas.com/read/2026/09/04/17150021/segera-bentuk-badan-pelindungan-data-pribadi). Lembaga PDP belum terbentuk; penegakan administratif belum efektif, pidana sudah [CNBC 2026](https://www.cnbcindonesia.com/tech/20260916115609-37-768328/lembaga-perlindungan-data-belum-ada-di-ri-padahal-aturannya-sudah-ada).

## Etika AI & patokan (bukan hukum Indonesia kecuali SE)
- SE Menkominfo 9/2023 Etika Kecerdasan Artifisial (soft law): inklusivitas, aksesibilitas, akuntabilitas, privasi; AI tidak menentukan keputusan "yang menyangkut kemanusiaan" [JDIH Komdigi](https://jdih.komdigi.go.id/produk_hukum/view/id/883/t/surat%20edaran%20menteri%20komunikasi%20dan%20informatika%20nomor%209%20tahun%202023). Perpres Peta Jalan & Etika AI menunggu penetapan (2026).
- EU AI Act Annex III 4(a): AI rekrutmen = high-risk; contoh resmi: sistem yang **menskor jawaban lisan pelamar**; larangan pengenalan emosi di tempat kerja sejak Feb 2025 [EU](https://ai-act-service-desk.ec.europa.eu/en/employment-0). NYC LL144: bias audit tahunan + notice kandidat [NYC](https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page).
- Risiko pipeline: error ASR jadi "kutipan verbatim" yang salah; halusinasi bukti ("circumstantial inference") [arXiv](https://arxiv.org/abs/2406.03487); bias skor LLM; rekomendasi LLM bias menggeser keputusan manusia (human-in-the-loop saja belum cukup) [AIES](https://ojs.aaai.org/index.php/AIES/article/download/36749/38887/40824).
- Ketentuan Gemini API: Unpaid Services → data dipakai melatih & bisa ditinjau manusia, larangan mengirim data pribadi; Paid → DPA, bisa disimpan sementara di negara mana pun; pengguna 18+ [Google](https://ai.google.dev/gemini-api/terms). Tier yang dipakai tidak terlihat di repo `[UNVERIFIED]`.

## Cek terhadap produk (kode, statis)
| # | Temuan | Bukti | Pasal | Jenis |
|---|---|---|---|---|
| 1 | Tidak ada notice/consent/privasi sebelum mic; mic sudah dibuka di HardwareCheck | `web/src/pages/interview/InterviewPage.tsx:206-209`, `web/src/components/HardwareCheck.tsx:145` | 20–22, 27 | missing-spec |
| 2 | UI kandidat hanya bahasa Inggris walau assessment `id` | `InterviewPage.tsx:206-209,236-238`, `api/app/models/assessment.rb:9` | 22 (Penjelasan) | missing-spec |
| 3 | Layar akhir: "recorded" (audio tidak disimpan) & "hiring team will follow up" (tak ada kanal) | `InterviewPage.tsx:236-238` | 16(2) tidak menyesatkan | defective |
| 4 | Audio, transkrip, portfolio dikirim ke Google; tak ada dokumen transfer/sub-prosesor/consent transfer | `api/app/clients/gemini/live_client.rb:10,40`, `api/app/services/coverage/analyzer.rb:12-15`, `api/app/services/portfolios/generator.rb:10-13` | 51(5), 56 | missing-spec |
| 5 | Tak ada retensi/penghapusan; sesi tak bisa dihapus | `api/config/routes.rb:21,25`, `assessment.rb:7` | 16(2), 42–45 | missing-spec |
| 6 | Kandidat tak bisa akses/koreksi/keberatan; `assessor_notes` boleh kosong | `api/app/controllers/api/v1/sessions_controller.rb:148-153`, `api/db/schema.rb:63` | 6, 7, 10, 30, 32 | missing-spec |
| 7 | Skill tanpa bukti dipaksa L1 → "gap"; confidence tidak memengaruhi fit/gap | `generator.rb:81,161,173`, `schema.rb:115,120`, `api/app/services/fit_gap/engine.rb:46-56` | 29 akurasi | defective |
| 8 | Kutipan bukti tidak diverifikasi terhadap transkrip | `generator.rb:163,175` | 29(2) verifikasi | defective |
| 9 | Narasi budaya & "overall hiring recommendation" dari LLM tanpa bukti budaya | `fit_gap/engine.rb:130-131` | 16(2), 29, risiko 10 | defective |
| 10 | Sesi putus → `error` setelah 120 s, tak bisa disambung, portfolio tetap dibuat tanpa tanda "tidak lengkap"; `audio_complete` selalu `all_covered` | `api/app/channels/audio_websocket_middleware.rb:12,509-510,757`, `api/app/services/sessions/end_handler.rb`, `sessions_controller.rb:127` | 29 | missing-spec + defective |
| 11 | Ambang 8/4 Mbps & speed test ke google/jsdelivr/unpkg/httpbin/postman-echo (IP kandidat ke pihak ketiga); tak ada jalur non-suara | `internetSpeedTest.ts:20-21,39-41,57-59,90-92`, `HardwareCheck.tsx:284` | 16(2), 26; UU 8/2016 Ps 11 | missing-spec |
| 12 | Tak ada `filter_parameter_logging`; body error API LLM di-log | `api/config/environments/production.rb:31`, `api/app/clients/gemini/http_client.rb:78` | 35, 36, 39 | missing-spec |
| 13 | Invite token tanpa kedaluwarsa, muncul di path & query WS | `api/app/models/session.rb:36`, `web/src/hooks/useAudioWebSocket.ts:39-40` | 35, 39 | missing-spec |
| 14 | Portfolio/override tanpa scope tenant (hipotesis IDOR lintas perusahaan) | `api/app/controllers/api/v1/portfolios_controller.rb:104,130,156`, `portfolio_skills_controller.rb:51-52` | 35, 39, 46 | defective |
| 15 | Tak ada cek usia (Gemini 18+; magang SMK) | — | 25 | missing-spec |
| 16 | Tak ada artefak DPIA/DPO/rekam pemrosesan/alur kebocoran di repo (mungkin ada di luar repo) | — | 31, 34, 46, 53 | missing-spec |
- Yang sudah baik: nama kandidat tidak dikirim ke Gemini (minimisasi); isi transkrip tidak di-log (hanya panjang); audio tidak disimpan permanen.

## Prinsip desain untuk kandidat (kriteria yang bisa diuji)
1. Notice + consent terpisah **sebelum** `getUserMedia`; memuat butir Pasal 21(1), pengendali/prosesor, Google sebagai sub-prosesor, transfer lintas batas; simpan versi + timestamp consent.
2. UI kandidat id/en mengikuti `assessment.language`; notice & consent selalu tersedia dalam Bahasa Indonesia sederhana.
3. "AI mewawancarai, manusia memutuskan" eksplisit sebelum mulai & di akhir; tak ada "hiring recommendation" dari LLM; keputusan merugikan wajib ID assessor + alasan.
4. `not_assessed` menggantikan L1 paksa (`ai_level` nullable); skill `not_yet/initiated` atau tanpa kutipan tervalidasi tidak pernah jadi "gap".
5. Setiap kutipan bukti dicocokkan ke giliran kandidat di `transcript_turns` (+ `turn_number`); yang gagal dibuang/ditandai.
6. Tidak menilai budaya/emosi/kepribadian tanpa kutipan eksplisit; tidak ada inferensi emosi dari suara.
7. Sesi terputus/`error` → ditandai tidak lengkap, portfolio tidak final, kandidat dapat kesempatan ulang lewat link yang sama.
8. Jalur alternatif & akomodasi (teks/chat atau wawancara manusia, tambahan waktu) tanpa wajib mengungkap diagnosis; gagal cek internet → tawarkan alternatif, bukan tombol terkunci.
9. Ambang konektivitas sesuai kebutuhan stream (±256 kbps naik); speed test hanya ke domain sendiri.
10. Tautan "minta salinan / koreksi / hapus / keberatan" di layar akhir & undangan; respons ≤3×24 jam; keberatan memicu penilaian ulang manusia.
11. Retensi terdefinisi (N hari pasca-keputusan, ditetapkan di kontrak) + job hapus otomatis + bukti penghapusan.
12. Tidak ada data pribadi/token di log; token tidak di URL WS; body error LLM tidak di-log; ada tes log bersih.
13. Invite token ber-TTL, dicabut setelah sesi berakhir.
14. Request lintas tenant ke portfolio/fit-gap/export/override → 404 (dengan request spec).
15. Sebelum go-live: DPIA, DPA dengan klien & Google (paid tier, sub-prosesor disetujui tertulis), bias audit berkala per bahasa/aksen/gender termasuk WER ASR.
