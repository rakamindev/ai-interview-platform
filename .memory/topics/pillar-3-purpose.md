# Pilar 3 — What It Is For

> Sintesis 2026-10-19 dari PRD wiki (pilar 1), riset industri/pengguna (pilar 2 & 4), dan kandidat/UU PDP (pilar 5). Ini penalaran, bukan data — hipotesis yang harus diuji saat produk dipakai end-to-end dan dengan pengguna nyata.

## Outcome yang ingin dihasilkan
- **Keputusan hiring yang lebih benar dan bisa dipertanggungjawabkan per kandidat**: setiap kandidat mendapat wawancara terstruktur setara pewawancara ahli (PRD 01: "If the AI doesn't behave like a skilled human interviewer, the product doesn't work"), dan pengambil keputusan mendapat level per skill yang tertaut ke anchor dan dibuktikan kutipan kandidat sendiri.
- Bentuk konkretnya (PRD 02): assessor bisa menjawab "di skill mana kandidat ini memenuhi, kurang, atau melebihi kebutuhan role, dan apa buktinya" dalam ±1 jam setelah undangan dikirim, tanpa menghadiri wawancara.
- Bukan sekadar efisiensi: nilainya hilang bila cepat tapi salah. Wawancara terstruktur adalah prediktor seleksi terkuat (Sackett 2022, pilar 2), sehingga outcome = **validitas yang bisa diskalakan**, bukan otomatisasi screening (yang sudah komoditas).

## Apa yang harus benar agar tetap berguna
1. **Perilaku AI = pewawancara ahli**: mem-probe jawaban spesifik, minimal satu follow-up per skill, tidak membacakan daftar pertanyaan, tidak menjawab untuk kandidat (PRD 01 §7) — juga dalam Bahasa Indonesia dan dengan aksen daerah.
2. **Setiap level dapat dibela**: kutipan benar-benar ada di transkrip; skill yang tidak sempat dinilai tampil "tidak dinilai", bukan L1; confidence jujur terhadap jumlah probing.
3. **Manusia yang memutuskan**: AI merekomendasikan, assessor/hiring manager memutuskan dengan override beralasan dan jejak audit (UU PDP Pasal 10; PP 33/2026 Pasal 94).
4. **Kandidat bisa menyelesaikan sesi**: berjalan di HP dengan koneksi rata-rata Indonesia, gangguan jaringan tidak menghukum kandidat, ada jalur alternatif.
5. **Data aman & sah**: isolasi antar-perusahaan klien, consent + notice dalam Bahasa Indonesia, retensi & penghapusan, transfer ke Google terdokumentasi, DPIA sebelum pemrosesan.
6. **Output bisa dipakai**: hasil bisa dibandingkan lintas kandidat, masuk ATS (JSON), dan dibaca hiring manager (PDF ringkas, berbahasa Indonesia).
- Bila salah satu dari 2, 3, atau 5 gagal, kepercayaan klien runtuh sekali kena insiden (kutipan palsu, kebocoran lintas tenant, keberatan kandidat) — itulah risiko eksistensial produk `[INFERENCE]`.

## Apa yang membuatnya penting bagi lebih banyak orang
- **Lebih banyak perusahaan**: dari kandidat senior teknologi (persona PRD) ke rekrutmen massal (MT, BUMN, SMK/fresh graduate) di mana wawancara manual adalah bottleneck terbesar — butuh Bahasa Indonesia sebagai default, durasi pendek, ATS export.
- **Lebih banyak kandidat**: menurunkan hambatan akses (ambang internet realistis, mobile, alternatif non-suara, akomodasi disabilitas) sehingga kandidat dari luar Jawa/perdesaan dan non-"orang dalam" mendapat kesempatan yang dinilai dengan rubrik yang sama.
- **Kandidat sebagai penerima nilai**: memberi kandidat sesuatu kembali (penjelasan proses, konfirmasi, hak akses/keberatan, idealnya ringkasan kekuatan) mengubah alat yang "dipaksakan" menjadi proses yang dipercaya — kepercayaan pelamar terhadap AI saat ini rendah (Gartner 2025: 26%).
- **Lebih banyak peran**: skill taxonomy (B7) + anchor universal memungkinkan peran non-teknis (sales, admin, soft skills) — selama anchor dan bukti tetap ketat.

## Pertanyaan terbuka (perlu jawaban user/stakeholder)
- Siapa pengendali vs prosesor data (perusahaan klien vs Rakamin)?
- Apakah hasil AI boleh menjadi satu-satunya dasar reject, atau selalu ada wawancara manusia setelahnya?
- Pasar sasaran utama: rekrutmen massal vs peran spesialis?
- Apa yang boleh diterima kandidat dari hasil penilaian?
