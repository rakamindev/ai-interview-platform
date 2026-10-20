# Pilar 4 — The Users: assessor, recruiter, hiring manager

> Riset web 2026-10-19 (subagent). Fakta bersumber ditandai link; sisanya `[INFERENCE]` dan perlu divalidasi dengan wawancara pengguna nyata.
> Di PRD 02, persona assessor = "Dimas, HR lead TechCorp" yang mengonfigurasi, memantau, mereview, menjalankan fit/gap, dan export — satu orang merangkap tiga peran.

## Recruiter / Talent Acquisition
- Hari kerja (fakta): ratusan–ribuan CV per lowongan, banyak lowongan paralel [CNBC 2026](https://www.cnbcindonesia.com/lifestyle/20260525164314-33-737899/cari-kerja-kian-mustahil-satu-lowongan-diserbu-ribuan-orang); 97% perusahaan merekrut di 2023, fungsi terbanyak Admin/HR & Akunting [JobStreet HCB 2024](https://id.jobstreet.com/id/about/news/article/hcb-report-2024); 46% kandidat drop-off setelah offer, 50% kandidat menilai proses kurang transparan (Kalibrr–Jakpat 2026) [asianic](https://asianicinsights.com/kalibrr-indonesia-ungkap-mismatch-ekspektasi-rekrutmen-2026-62-rekruter-mengira-kandidat-utamakan-gaji).
- KPI: time-to-hire, cost-per-hire, quality-of-hire (benchmark Indonesia `[UNVERIFIED]`).
- Job-to-be-done `[INFERENCE]`: memangkas long list jadi shortlist yang bisa dipertanggungjawabkan dalam hitungan hari tanpa menjadwalkan puluhan wawancara.
- Butuh `[INFERENCE]`: status sesi & coverage per kandidat, rekap yang bisa dibandingkan lintas kandidat (skill/anchor sama), ekspor ke ATS (JSON) + PDF yang bisa diteruskan, tingkat penyelesaian kandidat tinggi di HP.
- Berhenti memakai bila `[INFERENCE]`: banyak sesi gagal (koneksi/mic), keluhan kandidat, hasil tidak masuk ATS.

## Assessor (HR assessor, konsultan asesmen, psikolog, tim assessment center)
- Fakta: asesmen psikologi terikat Kode Etik HIMPSI [HIMPSI](https://himpsi.or.id/kode-etik); BUMN menstandarkan nilai AKHLAK & Learning Agility [FHCI](https://fhcibumn.com/gallery/news/siaran-pers-bersama-rekrutmen-bersama-bumn-rbb-2024-membuka-peluang-karir-dan-membangun-kolaborasi-sinergis-bumn-U5KYT0).
- Job-to-be-done `[INFERENCE]`: mendefinisikan skill + scope + anchor L1–L5 sekali, menerapkannya konsisten ke banyak kandidat, memvalidasi bahwa level AI sesuai anchor.
- Butuh `[INFERENCE]`: bukti per anchor (kutipan + timestamp), confidence + alasan level, override dengan catatan & jejak audit, pemisahan skill terkonfigurasi vs discovered, kalibrasi antar-assessor.
- Berhenti bila `[INFERENCE]`: level tidak bisa ditelusuri ke bukti, kutipan tidak cocok transkrip; produk disangka "psikotes" padahal bukan alat tes psikologi.

## Hiring Manager / User
- Fakta: 87% profesional HR menyebut preferensi interaksi manusia sebagai penghambat otomasi penuh (SHRM 2026, via [Talenta](https://www.talenta.co/blog/ai-in-hr-2026)); sebagian perusahaan besar kembali mewajibkan wawancara tatap muka untuk verifikasi [CNBC 2026](https://www.cnbcindonesia.com/tech/20260811141759-37-758286/cari-kerja-kantoran-susah-sekarang-marak-fenomena-wawancara-palsu).
- Job-to-be-done `[INFERENCE]`: memutuskan cepat siapa yang layak wawancara akhir dan yakin kandidat "bisa kerja" di timnya.
- Butuh `[INFERENCE]`: ringkasan satu halaman berbahasa Indonesia, tabel fit/gap terhadap vacancy, 2–3 kutipan terkuat per skill, saran pertanyaan lanjutan untuk wawancara final.
- Berhenti bila `[INFERENCE]`: rekomendasi terasa kotak hitam, narasi budaya generik, laporan berbahasa Inggris untuk user non-HR.

## Implikasi untuk produk (rangkuman)
1. Default durasi ±20–30 menit, 3–5 skill untuk volume tinggi; 60–90 menit untuk senior/MT `[INFERENCE]`.
2. Bahasa Indonesia sebagai default laporan & UI pengguna; `en` hanya bila bahasa Inggris memang dinilai.
3. Setiap kutipan bukti harus tervalidasi sebagai substring transkrip (+ timestamp); kutipan yang tidak cocok ditandai.
4. Level dikaitkan ke teks anchor; confidence turun otomatis bila coverage rendah.
5. Skill discovered tampil terpisah, tidak masuk fit/gap kecuali disetujui assessor.
6. Override wajib alasan + jejak audit (siapa, kapan, lama → baru); AI = rekomendasi, manusia memutuskan.
7. Narasi budaya fit/gap diberi label "interpretasi AI", bukan dasar keputusan tunggal.
8. Ekspor: PDF satu halaman (ID) + lampiran bukti; JSON skema stabil untuk ATS lokal (Talenta, KantorKu).
9. Live monitor bernilai untuk peran kritis & deteksi anomali; tidak wajib untuk volume tinggi.
