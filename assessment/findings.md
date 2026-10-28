# Temuan awal dan gap produk

Status: konsolidasi eksplorasi dan verifikasi sampai 27 Oktober 2026. Perbaikan audio memiliki evidence otomatis dan percakapan live singkat; portfolio, fit/gap, dan isi PDF/JSON juga telah diuji pada sesi 18. Ini bukan klaim stabil 45 menit atau akurasi penilaian. Scope dan acceptance criteria final submission berada di [scope-final.md](scope-final.md); rincian implementasi di audio-fix.md.

## Konteks dan ideal produk

Assessor perlu mengetahui apakah kandidat benar-benar menjalani wawancara, apakah bukti sudah cukup, dan apakah hasil siap ditinjau. Kandidat perlu mengetahui bila proses gagal serta tindakan berikutnya tanpa mengira evaluasinya sudah selesai. Hiring manager membutuhkan hasil yang bisa ditelusuri ke bukti, bukan sekadar label sukses.

PRD 01 menempatkan probing berdasarkan jawaban kandidat sebagai inti produk. PRD 02 memisahkan wawancara, pembuatan portfolio, review, dan fit/gap. Berakhirnya sesi tidak otomatis berarti coverage cukup atau portfolio berhasil.

Pengamatan ini berasal dari pengujian lokal, bukan riset pengguna atau pengukuran prevalensi di pasar. Konteks industri hiring Indonesia dan pemetaan awal UU PDP telah ditambahkan pada [laporan review](report-draft.md), Step 2, dengan sumber primer. Riset pengguna langsung dan review legal belum dilakukan. Tidak ada klaim kepatuhan hukum dalam dokumen ini.

## Klasifikasi

- **Bug implementasi:** perilaku kode salah terhadap kontrak yang jelas atau terhadap fungsi yang dijanjikan UI.
- **Gap spesifikasi/produk:** perilaku yang dibutuhkan belum ditentukan secara lengkap.
- **Kendala konfigurasi/lingkungan:** setup lokal atau dependensi tidak sesuai; tidak otomatis merupakan bug inti produk.
- **Observasi terbuka:** gejala sudah terlihat tetapi akar masalah belum dibuktikan.

Prioritas berikut menjadi acuan submission saat ini dan dapat berubah bila ada bukti baru: P0 untuk risiko kritis yang terbukti, P1 untuk alur utama terblokir atau evaluasi/proses yang menyesatkan, P2 untuk gangguan pemahaman/pemulihan dengan workaround, dan P3 untuk perbaikan kecil. Tidak ada P0/P3 yang dikonfirmasi. Severity berbeda dari status penyelesaian; F04/F06 dipulihkan secara lokal. F09/F11 merupakan satu rantai masalah. F08 tetap terbatas pada diagnostik development, bukan hasil audit keamanan menyeluruh.

## Ringkasan

| ID | Temuan | Kategori | Prioritas submission | Status |
| --- | --- | --- | --- | --- |
| F01 | Kandidat melihat keberhasilan ketika sesi gagal | Bug implementasi | P1 | Outcome API/UI diperbaiki dan tes lulus; live setelah patch pending |
| F13 | Layout mobile/teks panjang membuat kontrol keluar viewport | Bug layout | P2 | Diperbaiki E13; 16/16 fixture viewport lulus, ponsel fisik belum diuji |
| F02 | Retry hardware berhenti di pemeriksaan OS | Bug implementasi | P2 | Source diperbaiki E12; 5 regression tests/suite 31 lulus; Retry juga lulus built-UI fixture E13; perangkat nyata belum diverifikasi ulang |
| F03 | Status sesi dan kesiapan portfolio kurang jelas bagi assessor | Gap presentasi fullstack | P2 | Teramati; kontrak status perlu diperjelas |
| F04 | Portfolio gagal pada panggilan Gemini | Kendala konfigurasi/integrasi | P1 saat terjadi | Dipulihkan pada sesi 18; error lifecycle menyeluruh belum selesai |
| F05 | Internet check memblokir tanpa penjelasan ambang/pemulihan | Gap UX dan pengukuran | P2 | Teramati; validitas metode belum diputuskan |
| F06 | Link undangan menunjuk origin API | Konfigurasi/panduan setup | P1 saat terjadi | Konfigurasi lokal dipulihkan |
| F07 | AI diam dan transcript kandidat tidak muncul pada percobaan lanjutan | Bug audio dan batas runtime | P1 | Fokus perbaikan fullstack; tes dan live singkat berhasil, endurance/recovery live belum lengkap |
| F08 | Token undangan terlihat dalam log development | Paparan pada diagnostik | P2 | Teramati; cakupan production belum diuji |
| F09 | Skill tanpa evidence tetap diberi L1 | Gap penilaian dan kontrak data | P1 | Backlog pertama bersama F11; belum diperbaiki |
| F10 | Kolom Required pada fit/gap kosong | Bug kontrak API/frontend | P2 | Screenshot dan mismatch expected_level/required_level; belum diperbaiki |
| F11 | L1 tanpa evidence ikut dihitung sebagai gap | Dampak lanjutan F09 pada fit/gap | P1 | Dampak lanjutan F09; belum diperbaiki |
| F12 | Error lama masih tersimpan ketika portfolio complete | Bug konsistensi status/data | P2 | Teramati di JSON; belum diperbaiki |
| O01 | Follow-up AI bergeser dari negosiasi desain ke state React | Observasi kualitas AI | Belum ditetapkan | Sampel terlalu kecil untuk kesimpulan umum |

## F01 - Kandidat melihat keberhasilan ketika sesi gagal

**Dampak:** kandidat dapat mengira wawancara dan pencatatan berhasil meskipun model gagal memulai atau sesi berakhir karena error.

**Reproduksi yang diamati:** buka undangan, mulai wawancara dengan model Live yang ditolak Gemini, tunggu retry koneksi habis, lalu lihat halaman akhir.

**Aktual:** UI menampilkan `Interview Complete` dan klaim bahwa wawancara telah direkam. Log sesi pengujian menunjukkan penolakan Gemini kode 1008, tiga retry, lalu `Session ... ended (reason=error)`.

**Expected yang diusulkan:** kegagalan teknis ditampilkan sebagai gagal/terputus dengan arahan pemulihan. Klaim transcript tersimpan atau hasil lengkap hanya tampil bila ada dasar data. Sesi yang diakhiri manual dapat menyimpan bukti parsial, tetapi tidak disebut seluruh skill sudah dinilai.

**Kode terkait pada baseline:** `web/src/pages/interview/InterviewPage.tsx` memetakan `session_status === 'ended'` ke state `complete`, dan juga memetakan kegagalan request candidate info ke `complete`. `api/app/controllers/api/v1/sessions_controller.rb` pada `candidate_info` belum mengirim alasan sesi berakhir. `api/app/services/sessions/end_handler.rb` menyimpan status `ended` bahkan ketika alasan berakhir `error`.

**Bukti:** screenshot halaman akhir dan log runtime dalam percakapan; tambahkan salinan yang disanitasi ke paket evidence sebelum submission. Korelasikan session ID dan waktu pada reproduksi final agar bukti before/after berasal dari skenario yang sama.

**Uji ulang reload/resume:** pengguna me-reload tanpa End Interview dan melihat Interview Complete. Metadata sesi terbaru (20) menunjukkan ended/error; log menunjukkan retry Gemini habis. Gangguan Gemini sudah tampak sebelum browser disconnect, sehingga sebab tunggal reload belum dibuktikan. Ini bukti tambahan F01, bukan penutupan recovery F07. Lihat evidence/manual-recovery-mobile.md M03.

**Update implementasi reload/outcome:** perbaikan kini membedakan complete normal, ended/error, gagal load, dan koneksi putus. End Interview menunggu ack; candidate_info mengirim end_reason dan sisa waktu. Backend membatalkan pekerjaan koneksi detached dan mencoba satu context reconstruction bila handle resume ditolak secara spesifik. 25 tes frontend/18 backend lulus; uji live setelah patch masih pending. Detail serta batas abandoned-session/multi-tab ada di [reload-resume-fix.md](reload-resume-fix.md). Tidak ada sesi ended/error yang dibuka ulang.

## F02 - Retry hardware macet

**Prioritas submission:** P2, direvisi dari P1 karena kerusakan tombol Retry memiliki workaround reload lokal. Perubahan severity ini tidak menutup bug.

**Dampak:** kandidat tidak dapat memulihkan pemeriksaan dari tombol yang disediakan dan tidak bisa memulai sesi.

**Reproduksi:** biarkan tes internet gagal, klik Retry, lalu perhatikan `OS & browser` terus `Checking`.

**Aktual dan akar masalah:** `retryAll` mengatur OS ke `LOADING`, tetapi effect pemeriksaan OS memiliki dependency `[]`, sehingga hanya dijalankan saat mount. Perubahan state oleh Retry tidak memulai kembali pemeriksaan.

**Expected:** setiap Retry menjalankan ulang satu siklus pemeriksaan, menyelesaikan atau menampilkan kegagalan yang dapat dipahami, dan membersihkan pekerjaan siklus sebelumnya.

**Kode:** `web/src/components/HardwareCheck.tsx`.

**Workaround:** reload halaman. Ini tidak memperbaiki bug Retry dan tidak menjamin tes jaringan lulus.

**Uji ulang error/recovery:** saat menguji izin mikrofon Block, OS/browser baru tertahan setelah Retry; recovery tombol gagal sesuai F02. Setelah reload tanpa Retry, pengguna melihat Microphone Failed/Start nonaktif. Allow + reload menghasilkan Passed/Start aktif. Penolakan dan workaround reload lulus terbatas, tetapi bug Retry tetap terbuka. Lihat evidence/manual-recovery-mobile.md. Tidak ada perbaikan kode pada tahap pencatatan ini.

**Update 28 Oktober:** perbaikan E12 membuat setiap Retry memulai percobaan baru dan membersihkan timer/stream/context. Lima tes gagal sebelum perubahan, lalu lima lulus; suite 31 lulus. Riwayat reproduksi di atas tetap dipertahankan. Lihat [hardware-retry-fix.md](hardware-retry-fix.md); tidak mengubah threshold internet.

## F03 - Status sesi dan portfolio kurang jelas bagi assessor

**Dampak:** assessor melihat `Completed` dengan tombol Results, tetapi saat membuka hasil menemukan `Portfolio generation failed`; kesiapan hasil tidak terlihat dari daftar.

**Aktual:** screenshot daftar kandidat menunjukkan `Completed`, sedangkan halaman portfolio untuk sesi yang sama menampilkan gagal. Kode daftar sudah menampilkan `Failed` bila `end_reason === 'error'`; jadi tidak benar bahwa seluruh kegagalan sesi selalu dilabeli Completed pada layar assessor. Masalah yang dibuktikan di sini adalah perbedaan status sesi berakhir dan status portfolio.

**Expected yang diusulkan:** tampilkan dua informasi yang berbeda: hasil proses wawancara dan kesiapan portfolio. Tombol melihat hasil boleh membuka halaman proses/gagal bila label serta tindakannya jelas; navigasi Results ke portfolio sendiri bukan bug.

**Kode:** `web/src/pages/assessments/AssessmentInvitePage.tsx`, `web/src/pages/portfolio/PortfolioPage.tsx`, dan serialisasi sesi pada `api/app/controllers/api/v1/sessions_controller.rb`.

**Risiko tambahan dari pembacaan kode:** tombol PDF/JSON dirender ketika `!generating && portfolio`, termasuk portfolio berstatus failed; backend sudah menolak ekspor yang belum complete. Perilaku klik ekspor pada kondisi gagal belum direproduksi terpisah.

## F04 - Pembuatan portfolio gagal pada integrasi Gemini

**Dampak:** assessor tidak memperoleh penilaian setelah kandidat mengakhiri sesi; alur review dan fit/gap terhenti.

**Bukti runtime:** job `PortfolioGeneratorWorker` untuk sesi pengujian menerima `Gemini::HttpClient::ApiError: API returned 404`; metadata retry juga memuat respons sebelumnya 400. Model yang dikonfigurasi pengguna saat itu adalah `gemini-2.0-pro-001` dan `gemini-2.0-flash-001`.

**Batas kesimpulan:** respons 404 tidak sendirinya membuktikan seluruh penyebab. Model lama merupakan kandidat penyebab kuat; response body lengkap dan kompatibilitas payload belum dikonfirmasi. Update verifikasi: endpoint REST dikoreksi dari v1 ke v1beta, lalu hambatan kuota dan ketersediaan model ditelusuri. Portfolio sesi 18 akhirnya berstatus complete dengan 3 skill tersimpan dan pengguna mengonfirmasi hasil tampil. Keberhasilan pembuatan tidak otomatis memvalidasi kualitas penilaiannya; lihat F09, O02, O03 dan audio-fix.md untuk rincian.

**Expected:** kegagalan job ditampilkan secara jujur, kegagalan konfigurasi tidak disamakan dengan kualitas kandidat, dan retry setelah perbaikan dapat memproses sesi yang sama.

**Kode:** `api/app/services/portfolios/generator.rb`, `api/app/workers/portfolio_generator_worker.rb`, `api/app/controllers/api/v1/portfolios_controller.rb`.

## F05 - Internet check kurang menjelaskan kegagalan

**Dampak:** kandidat terblokir sebelum pemeriksaan mikrofon/audio tanpa mengetahui batas minimum atau apakah penyebabnya layanan tes, koneksi, atau browser.

**Observasi:** hasil awal download 9,22 Mbps, upload 0,67 Mbps, ping 46 ms; setelah ganti jaringan download 43,96 Mbps, upload 2,98 Mbps, ping 40 ms. Upload gagal terhadap batas kode 4 Mbps. Batas lain adalah download 8 Mbps dan ping maksimum 300 ms.

**Metode saat ini:** ping/download/upload menggunakan layanan eksternal kecuali override tertentu diisi. Upload mengukur waktu request ke layanan penerima data; latency dan performa layanan ikut berpengaruh. Pemeriksaan mikrofon/audio baru berjalan bila internet lulus.

**Eksperimen terbatas:** mengarahkan ping/upload ke localhost menghasilkan lulus. Jalurnya berbeda sehingga eksperimen ini tidak membuktikan jaringan internet baik ataupun pengukuran eksternal pasti salah. Download masih memakai endpoint eksternal.

**Expected yang diusulkan:** jelaskan alasan gagal dan batasnya, bedakan gagal mengukur dari hasil koneksi rendah, serta tentukan kebijakan pemulihan berdasarkan kebutuhan audio nyata. Dasar produk untuk ambang 4 Mbps belum ditemukan dalam PRD yang dibaca. Jangan mengubah threshold hanya untuk meloloskan uji.

**Kode:** `web/src/utils/internetSpeedTest.ts`, `web/src/components/HardwareCheck.tsx`.

## F06 - Origin undangan salah pada setup lokal

**Dampak:** kandidat menerima Rails routing error saat membuka undangan.

**Aktual:** link awal memakai port 3001. Halaman `/interview/:token` dimiliki React di port 5173. `Session#invite_url` memakai `APP_BASE_URL`, dengan fallback origin API. Panduan awal juga menggambarkan variabel ini sebagai backend base URL.

**Pemulihan teramati:** `APP_BASE_URL` diarahkan ke origin frontend; halaman kandidat dapat dibuka. Sesi tidak perlu dibuat ulang hanya untuk mengganti origin karena URL dihitung dari konfigurasi saat diserialisasi.

**Kode:** `api/app/models/session.rb`, `web/src/App.tsx`.

## F07 - AI diam pada sebagian percobaan

**Dampak:** kandidat berbicara tanpa respons yang dapat diandalkan dan waktu wawancara terus berjalan; bukti penilaian berisiko tidak terkumpul.

**Observasi pengguna:** ucapan kandidat tidak muncul di transcript; teks AI kadang muncul. Ada satu sesi sebelumnya yang menghasilkan interaksi dan transcript.

**Log:** backend meneruskan chunk audio, silence pump aktif, browser sempat terputus dengan kode 1001, watchdog melakukan reconnect setelah 30 detik, dan Gemini kembali mencapai `setupComplete`.

**Batas kesimpulan:** frame yang dikirim tidak membuktikan suara non-hening atau format audio benar. Belum diketahui apakah masalah berada di perangkat, capture/gating audio, transcription, model, atau playback. Reconnect setelah browser terputus adalah indikasi yang perlu ditelusuri, belum akar masalah terkonfirmasi.

**Investigasi berikutnya:** periksa indikator mikrofon, transcript input/output, jumlah audio balasan, state playback browser, dan korelasi waktu koneksi. Gunakan sesi fiktif dan log metadata tanpa merekam isi sensitif.

**Update perbaikan terkini:** setelah beberapa tahap investigasi, source capture/playback, processor PCM, akhir model turn, watchdog, dan resume diperbaiki. Evidence final mencatat 14 tes frontend dan 8 contoh backend lulus, ditambah browser sintetis serta seeded fault lokal yang menangkap sinyal resume hilang. Pengguna kemudian mengonfirmasi percakapan beberapa giliran dan hasil portfolio. Gejala/log di atas adalah baseline historis; tidak semua sesi terbukti memiliki akar masalah identik. Endurance, live reconnect menyeluruh, mobile, serta semua failure paths masih terbuka; lihat scope-final.md AC01-AC14 dan V01-V07.

## F08 - Token undangan masuk log diagnostik

**Dampak:** orang yang memperoleh log dapat melihat token yang dipakai untuk mengakses alur kandidat.

**Bukti:** log development yang dibagikan menampilkan token pada request path, parameter `token`, dan bind query `invite_token`. Dokumen ini sengaja tidak menyalin nilainya.

**Batas kesimpulan:** konfigurasi logging production dan kebijakan akses/retensi belum diperiksa. Severity perlu dikonfirmasi terhadap cakupan akses token dan lingkungan deployment. Ini temuan terbatas, bukan pernyataan bahwa data production telah bocor.

**Tindakan:** sanitasi evidence sekarang; evaluasi filtering parameter, path, dan SQL sebelum rilis. Filtering parameter saja tidak otomatis menghapus token dari URL log.

## O01 - Follow-up belum cukup mendalami contoh kandidat

Kandidat membahas negosiasi permintaan desain dan kebutuhan. AI menyinggung perubahan desain, kemudian bertanya tentang state React yang belum disebut kandidat. Ini berkaitan dengan agenda frontend, tetapi belum menggali keputusan, tindakan, dan hasil pada contoh tersebut.

PRD 01 menghendaki follow-up yang bereaksi pada jawaban spesifik. Satu contoh ini layak menjadi bahan QA prompt; belum cukup untuk menyimpulkan semua probing gagal atau menetapkan severity. Kualitas transkripsi juga perlu dipisahkan dari penilaian kemampuan kandidat.

## F09 - Skill tanpa evidence tetap mendapat level L1

**Status:** teramati pada portfolio sesi uji 18 yang dibagikan pengguna; akar perilaku juga terlihat pada source generator. Belum diperbaiki.

**Dampak:** assessor dapat menganggap kemampuan rendah sudah terukur, padahal skill belum dinilai. Pengujian fit/gap berikutnya memperlihatkan System Design L1 tanpa evidence ikut menjadi Gap -1 terhadap target L2; lihat F11 untuk dampak lanjutan dan batas kesimpulan.

**Reproduksi:** jalankan interview dengan jawaban singkat untuk React/pengujian, akhiri sebelum menjawab pertanyaan System Design, lalu buka Results setelah portfolio selesai dibuat.

**Aktual:** System Design & Architecture mendapat L1 dan confidence LOW, tanpa kutipan evidence. Ringkasan secara eksplisit menyatakan tidak ada jawaban substantif dan baseline L1 diberikan karena kekurangan evidence. Level, confidence, dan ketersediaan evidence merupakan informasi berbeda; LOW tidak mengubah L1 menjadi belum dinilai.

**Expected yang diusulkan:** tampilkan belum dinilai / bukti belum cukup tanpa memaksakan level kemampuan. Fit/gap harus membedakan nilai yang didukung evidence dari skill yang belum terukur. Detail representasi data dan tampilan perlu dirancang sebelum implementasi.

**Bukti source:** `api/app/services/portfolios/generator.rb` menggunakan `skill_data['level'].to_i.clamp(1, 5)`; nilai level yang hilang atau nol menjadi 1. Prompt juga meminta level untuk setiap skill. `api/app/models/portfolio_skill.rb` mewajibkan integer 1..5, sehingga perubahan yang benar harus mencakup kontrak penyimpanan, bukan prompt saja. Pada contoh runtime ini model memang menyatakan baseline L1; belum dibuktikan bahwa clamp merupakan satu-satunya penyebab.

**Batas kesimpulan:** contoh ini membuktikan hasil tidak membedakan evidence kosong dari L1 pada satu skill/sesi. Tidak membuktikan semua portfolio mengalami kesalahan serupa. Kutipan kandidat dan identitas tidak disalin ke catatan ini.

## O02 - Confidence HIGH React perlu dicocokkan dengan coverage

Portfolio sesi 18 memberi React / Frontend Development Core level L1 dengan confidence HIGH dari dua kutipan jawaban yang masih umum. Dua kutipan bukan berarti hanya dua probe; coverage map dan probe_count sesi tersebut belum diambil. Prompt generator mengaitkan HIGH dengan probe_count >= 3 dan state covered. Perlu cek apakah coverage benar-benar menunjukkan penggalian yang memadai dan apakah confidence selaras dengan bukti. Belum ditetapkan sebagai pelanggaran terkonfirmasi terhadap aturan confidence PRD.

## O03 - Penilaian Communication berpotensi memakai artefak transkripsi

Portfolio sesi 18 memberi Communication L1/LOW dan menyimpulkan kandidat berpindah bahasa serta tidak mampu menjaga komunikasi profesional. Sebagian evidence berupa ucapan sangat singkat dan token berbahasa asing pada transcript. Tanpa membandingkan audio asli, belum diketahui apakah token tersebut memang diucapkan atau salah ditranskripsikan. Catat sebagai risiko penilaian berbasis transcript yang belum diverifikasi; jangan menyatakan kesalahan transkripsi sudah terbukti. Evaluasi komunikasi perlu konteks dan evidence yang relevan, bukan hanya token yang ambigu.

## F10 - Target level Required kosong pada tabel fit/gap

**Kategori/prioritas sementara:** bug kontrak API/frontend, P2. **Status:** teramati pada screenshot pengguna dan didukung pembacaan source; belum diperbaiki.

**Dampak:** assessor melihat angka gap tanpa target pembanding yang terlihat, sehingga tidak dapat memeriksa perhitungan dari tabel yang sama.

**Reproduksi:** buat vacancy dengan React L3, Communication L3, System Design L2; pilih vacancy dari portfolio yang selesai, lalu jalankan Run Fit/Gap Analysis.

**Aktual:** screenshot Fit/Gap Report menunjukkan kolom Required kosong pada tiga baris. Candidate seluruhnya L1, dengan hasil React Gap -2, System Design Gap -1, Communication Gap -2. Ini konsisten dengan perbandingan target yang diisi, tetapi tidak membuktikan bahwa semua input/perhitungan sudah benar.

**Bukti source:** `api/app/services/fit_gap/engine.rb` menghasilkan field `expected_level`, sedangkan `web/src/components/fitgap/ComparisonTable.tsx` membaca `c.required_level`. Tipe `SkillComparison` pada `web/src/types/index.ts` juga mendeklarasikan `required_level`. Ketidaksesuaian nama field menjelaskan kolom kosong meskipun backend menghitung delta. Payload request/response sesi ini belum diarsipkan terpisah.

**Expected:** target L3/L2/L3 muncul pada baris yang tepat, dengan kontrak nama field konsisten antara API, tipe frontend, tabel, dan ekspor. Data target hilang harus mendapat penanda eksplisit, bukan sel kosong.

**Evidence:** screenshot pengguna `codex-clipboard-c533673d-2a74-4d8c-aa07-30cef2fc5dec.png` pada percakapan pengujian. Salinan screenshot untuk paket submission belum disiapkan. Update: PDF dua halaman dan JSON telah diperiksa. Required tampil di PDF dan expected_level terisi di JSON; kolom kosong terlokalisasi pada tampilan web yang diuji. Lihat evidence/fitgap-export-verification.md; layout PDF belum dirender untuk QA visual menyeluruh.

## F11 - Skill tanpa evidence ikut dihitung sebagai gap kemampuan

**Kategori/prioritas submission:** dampak lanjutan kontrak penilaian F09, P1. **Status:** teramati pada alur portfolio ke fit/gap; belum diperbaiki. Ini satu rantai masalah dengan F09, bukan dua akar masalah independen.

**Dampak:** kekurangan bukti dapat diterjemahkan menjadi kekurangan kemampuan terhadap vacancy, memengaruhi interpretasi assessor dan ringkasan kecocokan kandidat.

**Aktual:** portfolio sebelumnya menyatakan System Design tidak mendapat jawaban substantif tetapi memberi baseline L1. Screenshot fit/gap berikutnya menampilkan skill tersebut sebagai Candidate L1 dengan Gap -1 terhadap target L2, dan ringkasan menghitung 3 gaps. Baris itu tidak membedakan evidence kosong dari kemampuan L1 yang benar-benar terukur.

**Bukti source:** `FitGap::Engine#build_skill_comparisons` menghitung delta bila record skill portfolio ditemukan. Cabang `not_assessed` dipakai saat skill portfolio tidak ditemukan. `effective_portfolio_skills` membawa level dan confidence tetapi tidak membawa evidence atau status kecukupan evidence. Karena L1 tanpa evidence sudah tersimpan, record tersebut mengikuti perbandingan numerik normal.

**Expected yang diusulkan:** pertahankan perbedaan belum dinilai/bukti tidak cukup dengan rating kemampuan. Skill yang belum terukur tidak otomatis dihitung sebagai gap kemampuan yang telah terbukti. Kontrak portfolio, override assessor, engine fit/gap, ringkasan, serta ekspor perlu diselaraskan. LOW confidence sendiri tidak boleh otomatis disamakan dengan belum dinilai karena masih bisa ada evidence terbatas yang valid.

**Batas kesimpulan:** dampak terlihat pada satu rangkaian portfolio dan screenshot fit/gap yang dibagikan pengguna. Belum ada bukti keputusan hiring nyata, pengujian semua jalur override, atau validasi semua hasil fit/gap. Pengujian otomatis dan perbaikan belum ditambahkan untuk temuan ini.

## F12 - generation_error lama tertinggal setelah portfolio complete

**Kategori/prioritas sementara:** bug konsistensi status/data, P2. **Status:** teramati pada ekspor JSON sesi 18 dan didukung source; belum diperbaiki.

**Dampak:** konsumen ekspor atau integrasi melihat sukses dan error bersamaan, sehingga tidak jelas apakah error aktif atau riwayat percobaan lama. Belum ada bukti integrasi eksternal benar-benar salah memprosesnya.

**Aktual:** JSON yang dibagikan pengguna memiliki `generation_status: complete`, waktu `generated_at` terisi, tiga skill tersimpan, tetapi `generation_error: API returned 400` masih ada. Portfolio dan fit/gap dapat dibuka; angka 400 tersebut tidak menunjukkan kegagalan baru dari ekspor ini.

**Bukti source:** `api/app/services/portfolios/generator.rb` menyimpan `generation_error` pada jalur rescue tetapi update sukses hanya mengisi `generation_status` dan `generated_at`. Controller regenerate membersihkan error saat antre ulang; meskipun demikian, jalur sukses generator sendiri tidak membersihkannya. Urutan persis retry/concurrency yang meninggalkan nilai pada sesi ini belum direkonstruksi; jangan menyimpulkan satu jalur retry tertentu sebagai satu-satunya penyebab.

**Expected:** ketika attempt berhasil, status aktif dan error aktif konsisten; `generation_error` dibersihkan. Jika riwayat kegagalan dibutuhkan, simpan terpisah dengan identitas/waktu attempt, bukan sebagai error aktif pada hasil complete. Race antarjob perlu dipertimbangkan sebelum implementasi final.

**Reproduksi yang perlu diotomatisasi:** siapkan portfolio dengan error percobaan lama, jalankan generator sukses menggunakan respons sintetis valid, lalu periksa status complete dan error null pada penyimpanan/serialisasi. Belum ada tes atau perubahan kode untuk F12.

**Evidence:** field status/error pada JSON ekspor pengguna, dirangkum tanpa kutipan jawaban pada `evidence/fitgap-export-verification.md`. Keberhasilan unduh dan isi ekspor dipisahkan dari masalah metadata ini.

## Constraint signal untuk Technical Lead

1. Runtime Windows dapat boot untuk REST tetapi EventMachine lokal tidak mendukung TLS; eksplorasi audio dipindahkan ke Docker dan pengecekan TLS berhasil.
2. Nama model pada konfigurasi contoh tidak dapat diasumsikan masih tersedia. Perlu owner dan proses pembaruan konfigurasi model serta uji kompatibilitas.
3. Pengujian E2E bergantung pada layanan/model berbayar, kuota, perangkat audio, dan jaringan. Gunakan fake client untuk regression test deterministik; pisahkan live smoke test.
4. Sesi gagal/parsial tidak boleh menghasilkan klaim bukti lengkap hanya karena record sesi sudah ended atau job selesai.
5. Status, retry, job yang sudah dijadwalkan, dan record lama perlu kontrak yang sama di API dan UI. Pola concurrency serta broker failure belum diuji.

## Bukti yang perlu dilengkapi sebelum laporan final

- Korelasi timestamp dan session ID untuk setiap screenshot/log yang disanitasi.
- Before/after dari perbaikan terpilih dengan skenario yang sama.
- Hasil tes otomatis, seeded fault, dan bukti AI verification moment.
- Portfolio, fit/gap, serta unduh/isi PDF-JSON telah diuji pada sesi 18; kemas screenshot teranonimisasi dan lengkapi QA visual/edge cases sebelum klaim lebih luas.
- Riset domain, sumber UU PDP, dan validasi kebutuhan pengguna; saat ini baru analisis awal dari brief dan eksplorasi lokal.

## Referensi

- [PRD 01: AI Interview Behavior](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-01-%E2%80%94-First-Principles:-AI-Interview-Behavior)
- [PRD 02: End-to-End Interview](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-02-%E2%80%94-Real-Simulation:-End%E2%80%90to%E2%80%90End-Interview)
- Brief Fullstack Product Engineer yang diberikan pengguna, bagian Steps 2-5 dan minimum baseline standards.

## F13 - Overflow layout pada viewport kecil dan teks panjang

**Prioritas:** P2. **Kategori:** bug layout/presentasi. Delapan dari 16 skenario fixture sebelum perbaikan mengalami overflow; pada interview 360 px dokumen menjadi 576 px sehingga Mic/End berada di luar layar. Portfolio 360 px melebar ke 1055 px akibat header dan teks tanpa spasi. Ini diperiksa pada UI build nyata, bukan hanya inspeksi class.

**Perbaikan:** wrapping/min-width pada header/container/teks dan aksi; tabel memiliki region scroll sendiri. Sesudah: 16/16 lulus pada 360/390/768/1280 px. F10 tentang nilai Required tetap terbuka. Tidak menganggap emulasi viewport sebagai uji semua ponsel. Bukti dan batas: [mobile-check.md](mobile-check.md), E13.
