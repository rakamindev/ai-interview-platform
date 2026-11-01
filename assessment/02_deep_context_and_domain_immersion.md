# Step 2: Deep Context & Domain Immersion

## 1. Produk

Bukan chatbot interview — ini **mesin konversi percakapan suara menjadi keputusan hiring terstruktur**. Audio kandidat di-proxy real-time ke Gemini (tidak dipersist, hanya `transcript_turns` teks yang disimpan). Coverage map memandu AI mem-probe skill sampai `covered`. Setelah interview, worker meng-generate *portfolio* (level 1–5 per skill + kutipan bukti), lalu *fit/gap report* membandingkannya ke `vacancy_skills`. Assessor bisa override manual — produk ini secara desain sudah mengakui AI bisa salah.

Setiap tahap konversi (transkripsi → skor → fit/gap) adalah titik di mana kesalahan merugikan kandidat secara nyata, bukan sekadar bug kosmetik.

## 2. Industri

Yang sudah komoditas: penjadwalan interview, ATS dasar, tes psikometri, video interview terekam. Yang masih jadi masalah nyata: rasio pelamar-per-lowongan tinggi di Indonesia membuat waktu assessor jadi sumber daya paling langka — di titik itulah produk ini punya leverage (screening otomatis tanpa kehilangan kedalaman percakapan). Dukungan bilingual (EN/ID) bukan kosmetik — soft-skill assessment sangat bergantung nuansa bahasa. UU PDP yang baru efektif penuh jadi pembeda kepercayaan, bukan sekadar checklist.

## 3. Tujuan Produk Ini Ada

Outcome inti: **membantu hiring manager memutuskan "lanjut/tidak" lebih cepat dan terstruktur, tanpa mengorbankan keadilan terhadap kandidat.** Syarat yang harus tetap benar:
- Kandidat yang buka link **harus** bisa mencoba interview — kalau ini rusak (F1), semua nilai di hilir tidak pernah tercipta.
- Skor yang dihasilkan harus bisa dipercaya assessor — field salah nama (F3) atau state menyesatkan (F4) merusak kepercayaan itu.
- Ketidakpastian harus jujur ditampilkan (`not_assessed`), bukan dipaksakan jadi angka.

## 4. Pengguna — Assessor / Recruiter / Hiring Manager

Satu aktor lewat satu antarmuka: buat assessment → undang kandidat → **menunggu tanpa sinyal** (assessor tidak tahu link gagal/belum dibuka — gap struktural, lihat Option B di [`04_revamp_strategy.md`](04_revamp_strategy.md)) → pantau Live Monitor → review Portfolio (di sinilah value automasi screening dipertaruhkan — kalau assessor tidak percaya angkanya, mereka kembali baca transcript manual) → Fit/Gap → export laporan.

## 5. Kandidat & UU PDP

Kandidat: risiko tertinggi, kontrol terendah — tidak memilih platform ini, hasil evaluasinya bisa menentukan tahun hidup mereka.

Data yang diproses: audio real-time (tidak dipersist — baik untuk minimisasi data, tapi bergantung pada praktik Gemini di sisi mereka), transkrip verbatim (persist tanpa retention policy), nama kandidat (plain string, berisiko masuk log), kutipan bukti (salinan kedua dari transkrip).

**Constraint signal untuk Technical Lead** (bukan diselesaikan di iterasi ini):
1. Tidak ada jalur teknis untuk *right to erasure* lintas `sessions`/`transcript_turns`/`portfolios`.
2. Tidak ada retention policy untuk transkrip/kutipan.
3. `invite_token` adalah satu-satunya kredensial kandidat — siapa pun yang punya link bisa akses sesi (diperparah oleh F1: link mati yang mungkin di-forward saat troubleshooting).
4. Tidak ada consent notice ke kandidat bahwa audio mereka diproses AI pihak ketiga.
