# Pilar 2 — The Industry: hiring & asesmen talenta di Indonesia

> Riset web 2026-10-19 (subagent, sumber dikutip; angka belum dicek ulang manual). `[INFERENCE]` = penalaran, bukan data. Detail lengkap: `agent://IndustryUsers` (sesi itu saja).

## Realitas pasar
- Angkatan kerja 154,0 jt; penganggur 7,46 jt; TPT 4,85% (BPS Agu 2025) — TPT usia 15–24 = 16,89%; menurut pendidikan: SMK 8,63% (tertinggi), SMA 6,88%, S1+ 5,39%. [bps.go.id/id/pressrelease/2025/11/05/2479](https://www.bps.go.id/id/pressrelease/2025/11/05/2479/unemployment-rate-was-4-85-percent--the-average-wage-of-employees-was-3-33-million-rupiah-.html), [kompas 2025](https://www.kompas.com/tren/read/2025/11/06/121500465/bps--jumlah-pengangguran-capai-7-46-juta-orang-pada-agustus-2025-lulusan)
- Ijazah = sinyal lemah: hanya 64,64% pemuda bekerja sesuai pendidikan; 22,36% overeducated, 13% undereducated (BPS 2024). [BPS mismatch](https://www.bps.go.id/id/publication/2025/10/31/c35e3066258c837175d3b097/cerita-data-statistik-untuk-indonesia---mismatch-pendidikan-pekerjaan-pemuda-indonesia--implikasi-bagi-bonus-demografi.html)
- Volume: ±500–600 lamaran per iklan, ribuan untuk posisi umum (JobStreet, Mar 2026) [CNBC](https://www.cnbcindonesia.com/lifestyle/20260525164314-33-737899/cari-kerja-kian-mustahil-satu-lowongan-diserbu-ribuan-orang); CPNS 2024: 3,9 jt pelamar untuk 250.407 formasi [BKN](https://www.bkn.go.id/pendaftaran-di-portal-bkn-berakhir-jumlah-pelamar-cpns-2024-capai-39-juta); Rekrutmen Bersama BUMN >2 jt pendaftar, tahapan TKD → AKHLAK → Inggris → Learning Agility → seleksi per BUMN [FHCI](https://fhcibumn.com/gallery/news/siaran-pers-bersama-rekrutmen-bersama-bumn-rbb-2024-membuka-peluang-karir-dan-membangun-kolaborasi-sinergis-bumn-U5KYT0).
- Pola rekrutmen massal: tes terstandar di depan, **wawancara manual di belakang = bottleneck** `[INFERENCE]`.

## Kondisi kandidat yang membentuk produk
- Penetrasi internet 81,7% (APJII 2026): Jawa 85,95%, Maluku–Papua 69,74%; urban 84,75% vs rural 78,18%. [Antara](https://www.antaranews.com/berita/5576225/survei-apjii-penetrasi-internet-di-indonesia-2026-capai-817-persen)
- Mobile: median download 30,5 / upload 13,93 Mbps; **persentil-10: 5,69 / 2,0 Mbps**; 98,7% pengguna online lewat HP (Ookla 1H 2025). [Ookla](https://www.ookla.com/articles/indonesia-connectivity-divide-1h2025)
  - Ambang HardwareCheck produk ini (download ≥ 8, upload ≥ 4 Mbps) menolak kandidat di bawah ±persentil-10–20, padahal audio Live API (PCM16 16 kHz naik / 24 kHz turun) ≈ 256 / 384 kbps [ai.google.dev](https://ai.google.dev/gemini-api/docs/live-api/capabilities) `[INFERENCE]`.
- Bahasa: 73,87% keluarga memakai bahasa daerah di rumah (LF SP2020) [Badan Bahasa](https://badanbahasa.kemendikdasmen.go.id/artikel-detail/3848/bahasa-daerah-dalam-impitan-zaman); EF EPI 2025 Indonesia peringkat 80, speaking terlemah [EF](https://www.ef.edu/epi/regions/asia/indonesia/); code-switching ID–EN masih topik riset ASR [ACL 2024](https://aclanthology.org/2024.sigul-1.18). Gemini Live mendukung `id-ID` [Vertex docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/configure-language-voice); akurasi aksen daerah `[UNVERIFIED]`.

## Apa yang sulit
- Volume vs kapasitas rekruter (ribuan CV, banyak lowongan paralel). [CNBC 2026](https://www.cnbcindonesia.com/lifestyle/20260525164314-33-737899/cari-kerja-kian-mustahil-satu-lowongan-diserbu-ribuan-orang)
- CV/cover letter makin dipoles AI → kehilangan nilai sinyal; maraknya wawancara palsu/curang. [CNBC 2026](https://www.cnbcindonesia.com/tech/20260811141759-37-758286/cari-kerja-kantoran-susah-sekarang-marak-fenomena-wawancara-palsu)
- "Orang dalam": 9 dari 10 pencari kerja menghubungi keluarga/kenalan (Sakernas 2022). [Kompas.id](https://www.kompas.id/artikel/orang-dalam-yang-jadi-andalan-para-pencari-kerja)
- Kualitas pewawancara tidak konsisten; wawancara tidak terstruktur validitasnya ±separuh yang terstruktur (lihat leverage).
- Kepercayaan: hanya 26% pelamar (global) percaya AI menilai adil (Gartner 2025) [Gartner](https://www.gartner.com/en/newsroom/press-releases/2025-07-31-gartner-survey-shows-just-26-percent-of-job-applicants-trust-ai-will-fairly-evaluate-them); data Indonesia `[UNVERIFIED]`.

## Apa yang sudah jadi komoditas
- Job board/marketplace: JobStreet, LinkedIn (±37 jt pengguna ID), Glints, Dealls (+ATS KantorKu), KitaLulus (AI screening premium), Kalibrr.
- ATS + AI screening: Mekari Talenta, Loker.id → ranking CV sudah fitur standar.
- Psikotes/asesmen lokal: Talentlytica, Talentics, biro psikologi (terikat Kode Etik HIMPSI Bab XI). [HIMPSI](https://himpsi.or.id/kode-etik)
- Tes skill/coding global: HackerRank, TestDome, Mercer|Mettl, dll.
- One-way video & AI interviewer: HireVue, KitaHQ, HeyMilo, micro1, Apriora; lokal MIND Interview (video async, klaim "siap UU PDP"), wawancara.ai, TalentGo AI. [daftar KitaLulus](https://www.kitalulus.com/blog/info-hrd/ai-interview-kerja)
- Murah & tidak membedakan `[INFERENCE]`: distribusi lowongan, parsing/ranking CV, penjadwalan, psikotes generik, video async "skor + ringkasan", skor tunggal tanpa bukti (HireVue menghentikan analisis wajah 2021 [Wired](https://www.wired.com/story/job-screening-service-halts-facial-analysis-applicants)).

## Di mana leverage sebenarnya
- **Wawancara terstruktur = prediktor seleksi terkuat**: Sackett et al. 2022 — terstruktur .42 vs tidak terstruktur .19 (GMA .31) [PubMed](https://pubmed.ncbi.nlm.nih.gov/34968080/). Format produk (skill + anchor L1–L5 + rubrik konsisten) menyasar metode ini, bukan psikotes `[INFERENCE]`.
- **Skala wawancara level ahli** di tahap yang selama ini manual; **probing adaptif** lebih sulit dicurangi daripada pertanyaan seragam `[INFERENCE]`.
- **Bukti, bukan skor**: kutipan verbatim per skill yang bisa dibela ke hiring manager dan menjadi penyeimbang jalur orang dalam `[INFERENCE]`.
- **Voice Bahasa Indonesia native** dengan toleransi code-switching `[INFERENCE]`.
- **Yang menggerus leverage**: bias LLM (studi UW 2024: preferensi nama 85,1% [UW](https://www.washington.edu/news/2024/10/31/ai-bias-resume-screening-race-gender/)) → risiko serupa untuk aksen/dialek `[INFERENCE]`; kutipan halusinasi; skill "discovered" tanpa rubrik; regulasi (UU PDP Pasal 10, EU AI Act Annex III high-risk untuk klien multinasional [EU](https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3)).
