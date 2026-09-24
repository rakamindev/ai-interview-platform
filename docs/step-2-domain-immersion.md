# Langkah 2 — Deep Context & Domain Immersion

Catatan ini memisahkan perilaku yang didefinisikan PRD, perilaku yang tampak pada kode/UI, dan implikasi yang perlu divalidasi. Ini konteks untuk Langkah 3, bukan keputusan severity atau usulan implementasi final.

## Batas eksplorasi

- Alur recruiter/assessor, kandidat, API, model, worker, serta PRD 01 dan PRD 02 ditelusuri.
- Tidak ada data kandidat nyata yang dibuka atau diubah. Pemeriksaan lokal sebelumnya hanya menggunakan hitungan agregat.
- Uji tampilan kandidat dilakukan dengan token palsu. UI menampilkan “Interview Complete” untuk tautan yang tidak valid.
- Wawancara AI nyata belum bisa dijalankan: konfigurasi lokal tidak memiliki Gemini API key dan tidak tersedia sesi uji yang aman. Karena itu, kualitas audio, transkripsi langsung, probing model, dan hasil portfolio belum diverifikasi lewat wawancara end-to-end. Alur itu dipahami dari PRD dan kode, bukan dianggap telah terbukti berjalan.

## 1. Produk dan alur yang dijanjikan

PRD memposisikan produk sebagai asesmen keterampilan berbasis wawancara suara. AI seharusnya menanggapi jawaban kandidat, menggali klaim yang kabur atau kuat, dan mengikuti bukti yang muncul—bukan membaca daftar pertanyaan statis. Setelah tiap giliran, peta cakupan keterampilan diperbarui; setelah sesi, transkrip dan peta itu diringkas menjadi bukti, level L1–L5, tingkat keyakinan, dan narasi kecocokan terhadap lowongan.

PRD 02 menggambarkan alur dari konfigurasi peran, waktu, bahasa, keterampilan, ruang lingkup dan jangkar perilaku; membuat tautan undangan; wawancara suara kandidat; pemantauan cakupan oleh assessor; pembuatan portfolio; perbandingan terhadap persyaratan lowongan; hingga ekspor hasil. PRD adalah target/perilaku referensi, bukan bukti bahwa setiap tahap telah bekerja pada instalasi lokal.

Pada implementasi yang ditelusuri, layar React dan endpoint Rails mendukung konfigurasi assessment, lowongan, pembuatan sesi/tautan, halaman kandidat, monitor cakupan, transkrip, portfolio, override assessor, fit-gap, serta ekspor. Audio kandidat diproksikan ke Gemini Live; transkrip disimpan per giliran. Analyzer mengirim konteks transkrip terbaru ke Gemini Flash, sementara generator portfolio mengirim transkrip penuh dan rubrik ke Gemini Pro. Fit-gap menghitung perbandingan level secara aturan dan meminta Gemini membuat narasi rekomendasi.

## 2. Industri dan konteks Indonesia

- Renstra BPSDM Komdigi 2025–2029 melaporkan mismatch antara keterampilan digital yang tersedia dan kebutuhan industri; dokumen itu mengutip 56,3% perusahaan yang disurvei menyatakan sulit/sangat sulit mencari pekerja dengan kemampuan digital, serta estimasi pengangguran talenta digital yang lebih tinggi daripada nasional. Ini sinyal konteks yang berasal dari dokumen kebijakan dan data yang dikutipnya, bukan ukuran universal untuk semua pekerjaan atau perekrut. [Renstra BPSDM Komdigi 2025–2029](https://bpsdm.komdigi.go.id/downloads/20/20260402095322-RENSTRA-BPSDM-KOMDIGI-2025-2029.pdf)
- BPS melaporkan TPT pemuda lebih dari dua kali rata-rata nasional dan lebih dari sepertiga pekerja muda berada pada pekerjaan yang tidak sesuai tingkat pendidikannya. Ini menunjukkan bahwa ijazah atau label CV saja dapat kurang menjelaskan kecocokan pekerjaan; bukti kompetensi yang relevan dapat memberi informasi tambahan, tetapi tidak otomatis mengatasi mismatch struktural. [BPS — mismatch pendidikan dan pekerjaan pemuda](https://www.bps.go.id/id/publication/2025/10/31/c35e3066258c837175d3b097/cerita-data-statistik-untuk-indonesia--mismatch-pendidikan-pekerjaan-pemuda-indonesia--implikasi-bagi-bonus-demografi.html)
- AI dapat mempercepat penyaringan dan menstrukturkan bukti, tetapi penilaian otomatis dapat mewarisi bias dari data/prompt atau memberi bobot tidak relevan pada bahasa, aksen, disabilitas, perangkat, koneksi, dan gaya komunikasi. ILO mencatat contoh mesin rekrutmen yang cenderung menguntungkan laki-laki karena pola data CV historis. Maka efisiensi bukan ukuran tunggal keberhasilan; relevansi kerja, akses yang adil, transparansi, dan koreksi manusia juga menentukan. [ILO — AI, equality at work in Indonesia](https://www.ilo.org/resource/news/ai-equality-work-indonesia-harnessing-technology-create-fair-inclusive-and)
- Akses digital tidak merata: BPS mencatat 72,78% penduduk mengakses internet pada 2024 dan 18,52% rumah tangga memiliki/menguasai komputer. Karena produk memerlukan audio langsung dan pemeriksaan koneksi, desain yang hanya berhasil dengan laptop serta koneksi stabil berisiko membatasi sebagian kandidat. Implikasi produk: evaluasi akses mobile, koneksi buruk, pemulihan sesi, akomodasi disabilitas, dan jalur alternatif yang tetap adil. [BPS — Statistik Telekomunikasi Indonesia 2024](https://www.bps.go.id/assets/publication/2025/08/29/beaa2be400eda6ce6c636ef8/statistik-telekomunikasi-indonesia-2024.html)

## 3. Untuk apa produk ini ada

### Hasil yang ingin dihasilkan

Mengubah wawancara menjadi bukti kompetensi yang lebih terstruktur dan dapat ditinjau: assessor mendapat contoh konkret, tingkat cakupan/keyakinan, serta perbandingan terhadap kebutuhan pekerjaan; kandidat dinilai berdasarkan pekerjaan yang relevan, bukan sekadar kemampuan menghafal jawaban atau kemiripan latar belakang.

### Syarat agar tetap berguna

1. Rubrik kompetensi dan jangkar L1–L5 harus terdefinisi, konsisten, relevan dengan peran, dan tidak mendorong proxy yang tidak relevan.
2. Audio/transkripsi dan alur model harus stabil; kegagalan, koneksi ulang, transkrip yang salah, skill yang belum terukur, dan confidence rendah terlihat jelas.
3. Hasil AI harus dapat ditelusuri ke bukti kandidat, dapat dikoreksi assessor, serta tidak disajikan sebagai kepastian atau keputusan final.
4. Kandidat memahami proses, memperoleh akses/akomodasi yang wajar, dan dapat menggunakan hak data pribadinya.
5. Data, token undangan, transkrip, hasil inferensi, dan pemroses eksternal dibatasi sesuai tujuan, diamankan, memiliki retensi, dan dapat dihapus/diakses melalui proses yang jelas.

### Leverage produk yang berpotensi

Nilai utama bukan “AI melakukan wawancara” semata, melainkan mengurangi variasi penilaian dengan rubrik berbasis perilaku dan bukti yang dapat direview. Bila portfolio menjadi dasar keputusan tanpa menguji kualitas bukti dan keterbatasannya, automasi justru mempercepat keputusan buruk.

## 4. Pengguna langsung: assessor, recruiter, hiring manager

| Tahap | Tujuan kerja/pain point yang perlu diselesaikan | Perilaku yang terlihat |
|---|---|---|
| Menyiapkan assessment | Menerjemahkan kebutuhan jabatan menjadi keterampilan, cakupan, level harapan, bahasa dan batas waktu; menjaga asesmen tetap relevan dan sebanding antar kandidat. | Form role/time/language; taxonomy atau skill custom; scope include/exclude; anchor L1–L5; urutan skill. |
| Mengundang | Mengirim tautan yang tepat kepada kandidat dan mengetahui status tiap sesi. | Buat sesi per kandidat; kandidat dapat diberi nama/ID; assessor mendapat URL undangan. |
| Memantau | Mengetahui apakah skill sudah tersentuh dan apakah sesi mengalami kendala atau perlu dihentikan. | Monitor menerima pembaruan peta cakupan real-time; assessor dapat melihat transkrip dan mengakhiri sesi. |
| Meninjau | Memutuskan dengan konteks, bukan angka tunggal; memahami bukti, confidence, skill belum terukur, dan batasan AI. | Portfolio menampilkan level, evidence, ringkasan, confidence; assessor dapat memberi override dan catatan. |
| Membandingkan/berbagi | Membandingkan kandidat dengan persyaratan lowongan dan menyampaikan hasil kepada hiring team. | Fit-gap menyajikan match/gap/exceed/not assessed, narasi, lalu PDF/JSON export. |

Kebutuhan tersembunyi di balik alur ini: kalibrasi rubrik antar assessor, waktu untuk meninjau bukti, penanganan pengecualian, jejak perubahan skor, dan mencegah narasi rekomendasi mendominasi bukti mentah.

## 5. Kandidat yang terdampak tanpa memilih alat

Kandidat perlu tahu siapa yang meminta data dan untuk tujuan apa; bahwa wawancara menggunakan AI dan mikrofon; data apa yang dikirim/disimpan; siapa yang dapat melihat hasil; berapa lama disimpan; bagaimana meminta akses/koreksi/penghapusan atau mengajukan keberatan; apa yang terjadi jika koneksi/perangkat gagal; serta kontak bantuan dan opsi akomodasi.

Kode UI kandidat saat ini menunjukkan jenis sesi suara, estimasi durasi, dan mekanisme follow-up AI. Pemeriksaan perangkat meminta akses mikrofon dan mengukur koneksi sebelum kandidat menekan mulai; kamera opsional berdasarkan flag. Namun, pada layar yang ditelusuri tidak tampak penjelasan penggunaan/retensi transkrip, pemroses AI, hak kandidat, kontak privasi, atau persetujuan yang direkam. UI menyebut mikrofon aktif sepanjang sesi, sementara implementasi memute pengiriman saat AI berbicara. Tautan token palsu yang diuji berakhir di layar “Interview Complete” dan memberi kesan wawancara telah direkam walaupun token tidak valid.

Risiko pengalaman/keadilan yang perlu dibawa ke evaluasi berikutnya:

- Perangkat atau internet buruk dapat membuat kandidat gagal sebelum skill dinilai; jangan mencampuradukkan kemampuan jaringan dengan kemampuan kerja.
- Bahasa, aksen, disfluensi, atau kebutuhan aksesibilitas dapat memengaruhi transkripsi/interpretasi. Rubrik harus memisahkan kompetensi kerja dari kecakapan verbal yang tidak relevan.
- Satu skor AI dapat memengaruhi peluang kerja dan tahun hidup seseorang. Kandidat perlu jalur koreksi/peninjauan manusia dan status “belum cukup bukti” yang bermakna.
- Tautan undangan berfungsi seperti kredensial bearer. Kode menaruh token di path halaman, query WebSocket, dan pesan auth; token tidak memiliki field masa berlaku di model sesi. Perlakukan sebagai rahasia, batasi masa hidup/revokasi, hindari pencatatan URL lengkap, dan validasi akses ulang.

## 6. Implikasi UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi

Ini pemetaan produk awal, bukan pendapat hukum. Dasar pemrosesan dan kewajiban aktual bergantung pada siapa yang bertindak sebagai Pengendali/Prosesor, tujuan, skala, konfigurasi deployment dan kontrak vendor.

| Area UU PDP | Relevansi terhadap alur produk | Konsekuensi desain/operasional |
|---|---|---|
| Dasar dan transparansi pemrosesan (Pasal 20–22, 27–28) | Candidate name/ID, suara/transkrip, level kompetensi, confidence, evidence, dan narasi fit-gap diproses untuk rekrutmen. UU mengenal beberapa dasar pemrosesan; persetujuan bukan satu-satunya dasar yang mungkin. Jika basis yang dipilih persetujuan, informasi tujuan, jenis/relevansi data, retensi, jangka waktu, hak, dan bukti persetujuan harus dikelola. | Tentukan peran Pengendali/Prosesor dan dasar per tujuan; berikan notice sebelum pengumpulan/akses mikrofon; catat versi notice, timestamp, dan bukti persetujuan bila memang basisnya consent. Jangan menyatukan tujuan tambahan seperti pelatihan model tanpa pemberitahuan/basis tersendiri. |
| Hak subjek data (Pasal 5–12, 30, 32, 40) | Kandidat punya hak atas informasi, koreksi, akses/salinan, penghentian/penghapusan sesuai ketentuan, penarikan persetujuan, pembatasan, dan keberatan atas keputusan yang hanya otomatis dengan dampak hukum/signifikan. | Sediakan kontak dan alur tiket/permintaan; data harus dapat ditemukan per kandidat dan per sesi; tetapkan prosedur koreksi transkrip/identitas, retensi/pemusnahan, pembatasan, serta eskalasi ke reviewer. Ada tenggat 3×24 jam untuk beberapa kewajiban koreksi/akses/penghentian berdasarkan pasal terkait. |
| Keputusan otomatis dan DPIA (Pasal 10, 34) | Sistem melakukan evaluasi/penskoran sistematis dengan teknologi baru; fit-gap menghasilkan narasi rekomendasi. PRD mengharapkan assessor meninjau bukti dan implementasi mendukung override, jadi belum ada bukti bahwa keputusan hiring dibuat sepenuhnya otomatis. | Lakukan penilaian dampak privasi (DPIA) karena bentuk pemrosesan berpotensi masuk kategori risiko tinggi Pasal 34; dokumentasikan dampak pada kandidat, bias/error, mitigasi dan human review. Jangan biarkan rekomendasi naratif menjadi penolakan otomatis. Kandidat perlu kanal keberatan sesuai konteks Pasal 10. |
| Data spesifik (Pasal 4) | UU menggolongkan data kesehatan, biometrik, genetika, catatan kejahatan, anak, dan keuangan sebagai data spesifik. Aplikasi menyimpan teks transkrip dan mengalirkan audio ke model; bukan berarti semua suara otomatis menjadi data biometrik. Percakapan dapat mengungkap data sensitif secara tidak sengaja. | Batasi prompt/pengumpulan pada skill relevan, larang assessor meminta data sensitif yang tidak dibutuhkan, minimalkan akses/retensi, dan tetapkan aturan bila kandidat mengungkapkannya. Jangan gunakan analisis emosi/identifikasi suara tanpa kajian tujuan dan basis terpisah. |
| Keamanan, akuntabilitas, dan vendor (Pasal 31, 35–39, 51–52) | Transkrip lengkap tersimpan; beberapa peran dan jalur memakai token; sesi memiliki tenant scope; data dikirim ke layanan Gemini. Repo tidak menunjukkan fitur retensi/pemusnahan transkrip atau log khusus yang memberi kandidat rekam jejak pemrosesannya. | Audit akses lintas tenant dan ekspor; terapkan least privilege, keamanan token, log pemrosesan yang tidak menyalin konten kandidat, jadwal retensi/penghapusan yang konsisten di DB/queue/backup; tinjau kontrak, instruksi, retensi, penggunaan data dan subprosesor vendor. Pengendali tetap bertanggung jawab atas pemrosesan oleh prosesor. |
| Transfer lintas negara (Pasal 56) | Audio dan teks transkrip dikirim ke Gemini. Repositori saja tidak membuktikan wilayah pemrosesan, retensi vendor, atau apakah transfer lintas negara terjadi dalam konfigurasi produksi. | Konfirmasi region, aliran data, retensi, subprosesor dan syarat layanan untuk produk/API yang benar-benar digunakan. Jika ada transfer ke luar Indonesia, penuhi urutan perlindungan memadai/setara, perlindungan mengikat, atau persetujuan sebagaimana Pasal 56; jangan menyimpulkan pemenuhan hanya dari pemakaian API. |
| Petugas fungsi PDP (Pasal 53–54) | Kewajiban menunjuk petugas berlaku jika salah satu kondisi Pasal 53 ayat (1) terpenuhi: pemrosesan untuk pelayanan publik; kegiatan inti memerlukan pemantauan teratur/sistematis skala besar; atau kegiatan inti memproses data spesifik/tindak pidana skala besar. MK menafsirkan kata “dan” pada huruf b sebagai “dan/atau”, sehingga kondisinya alternatif, bukan kumulatif. | Ukur skala dan sifat pemantauan aktual per tenant; nilai apakah produk/organisasi memenuhi salah satu kondisi dan tunjuk petugas fungsi PDP jika wajib. [Putusan MK 151/PUU-XXII/2024](https://www.mkri.id/perkara/persidangan/putusan?jenis=PUU&page=1&perPage=50&search=1%2FPUU-XXII%2F2024) |

UU mengelompokkan nama lengkap sebagai data pribadi umum dan data kesehatan/biometrik/anak, antara lain, sebagai spesifik. Hak subjek data dan dasar pemrosesan bersumber dari teks resmi UU. [UU 27/2022 di JDIH Komdigi — Pasal 4–10](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/) · [Pasal 20–22 dan 27–28](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/) · [Pasal 30–39](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/) · [Pasal 51–56](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/)

## 7. Sinyal konteks untuk Langkah 3

Belum ditetapkan P0–P3. Hal yang perlu diuji sebagai gap produk/teknis pada langkah berikutnya:

1. Wawancara real-time dan retry: batas keberhasilan audio, transcript, resume, timeout, dan status ketika provider gagal.
2. Hasil kandidat: apakah level/confidence/evidence cukup akurat, dapat dipertanggungjawabkan, serta menunjukkan skill tidak terukur dengan jelas.
3. Kandidat: notice privasi, hak dan kontak; kegagalan token; perangkat/koneksi/akomodasi; copy yang jujur pada setiap state.
4. Keputusan: kendali assessor, dokumentasi override, kalibrasi rubrik, bias, serta pencegahan rekomendasi AI diperlakukan sebagai keputusan final.
5. Data/arsitektur: pemisahan tenant pada semua resource turunan; kerahasiaan transkrip; lifecycle token; retensi, akses, koreksi dan penghapusan; aliran data eksternal.
6. Konfigurasi lokal: README menyetel APP_BASE_URL contoh ke port API (3001), tetapi SPA kandidat dilayani Vite pada 5173. Perlu verifikasi apakah tautan lokal dari sesi diarahkan ke host aplikasi yang benar.

## Sumber utama

- Brief Fullstack Product Engineer, Langkah 2 (PDF lampiran).
- PRD 01 — [First Principles: AI Interview Behavior](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-01-%E2%80%94-First-Principles%3A-AI-Interview-Behavior)
- PRD 02 — [Real Simulation: End-to-End Interview](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-02-%E2%80%94-Real-Simulation%3A-End%E2%80%90to%E2%80%90End-Interview)
- UU No. 27 Tahun 2022, JDIH Kementerian Komunikasi dan Digital.
- BPS, Statistik Telekomunikasi Indonesia 2024; BPSDM Komdigi, Renstra 2025–2029; ILO, AI for equality at work in Indonesia (20 November 2025).
