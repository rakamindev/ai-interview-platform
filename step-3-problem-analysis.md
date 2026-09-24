# Langkah 3 — Defining Problem & Gap to Ideal Condition

**Objek audit:** seluruh jalur produk pada `api/` dan `web/`: autentikasi/tenant, resource dan data model, alur wawancara WebSocket, analisis AI, worker, laporan, ekspor, UI assessor/kandidat, konfigurasi deployment, dan kontrak API–React.

**Metode dan batas:** static code review dan penelusuran UI/kode berbasis alur pada Langkah 2. Tidak dilakukan penetration test, pengujian model dengan Gemini, atau pengujian regresi pada langkah ini. Kredensial Gemini tidak tersedia; karena itu temuan perilaku produksi yang bergantung pada jawaban model/vendor ditandai sebagai risiko atau batas verifikasi, bukan klaim telah direproduksi. Tidak ada data kandidat nyata yang digunakan.

Severity mengukur dampak dan urgensi produk, bukan kepastian pelanggaran hukum. **P0:** insiden kritis luas/tanpa mitigasi; **P1:** dapat merusak isolasi data, keselamatan/keadilan keputusan, atau alur inti; **P2:** dampak penting namun terbatas/bersyarat; **P3:** polish, maintainability, atau dampak rendah. Tidak ditemukan temuan P0 yang dapat dipastikan dari pemeriksaan ini.

## Ringkasan severity

| ID | Severity | Jenis | Area | Impact statement |
|---|---|---|---|---|
| P1-01 | P1 | Defective implementation | API auth/tenant | Karena login menerima skema tenant dari header tanpa memeriksa keanggotaan user, akun valid dapat meminta token yang menunjuk tenant lain dan membaca/menulis datanya. |
| P1-02 | P1 | Defective implementation | API portfolio/data | Karena portfolio dan turunannya tidak diberi tenant scope, assessor dari tenant berbeda dapat membaca evidence/hasil kandidat atau mengubah rating dengan ID resource. |
| P1-03 | P1 | Defective implementation | Web kandidat/mikrofon | Kunjungan ke tautan kandidat dapat meminta akses mikrofon sebelum kandidat menekan mulai, dan jalur microphone-only tidak menghentikan stream pemeriksaan saat komponen dilepas. |
| P1-04 | P1 | Defective implementation | Scoring/cakupan | Worker dapat mengubah skill `partial` menjadi `covered` hanya berdasarkan empat hitungan probe, lalu memberi kesan bukti/confidence cukup meski analyzer belum membuktikannya. |
| P1-05 | P1 | Defective implementation | Web ↔ API ↔ Sidekiq/AI | Polling halaman fit-gap dapat mengantrekan job Gemini baru setiap lima detik selama hasil belum ada, sehingga satu permintaan dapat memicu biaya, beban, dan race berulang. |
| P1-06 | P1 | Defective implementation/config | Invite/web deployment | Konfigurasi deployment mengisi base tautan undangan dengan host API, sementara `/interview/:token` adalah route SPA; kandidat berpotensi menerima URL yang tidak membuka UI wawancara. |
| P1-07 | P1 | Missing specification | Kandidat/UU PDP | Tidak ditemukan notice pemrosesan, kontak hak kandidat, jadwal retensi/pemusnahan, atau proses akses/koreksi/penghapusan untuk transkrip dan inferensi yang memengaruhi peluang kerja. |
| P1-08 | P1 | Defective implementation | AI evidence/scoring | Portfolio meminta rating untuk setiap skill tetapi tidak memvalidasi evidence terhadap giliran kandidat atau menolak instruksi prompt injection, sehingga bukti/level yang tidak sahih dapat tampil sebagai penilaian. |
| P2-01 | P2 | Defective implementation + missing specification | Invite/WebSocket | Token undangan bearer ikut dalam query URL WebSocket, tidak memiliki waktu kedaluwarsa/revokasi model, dan dapat bertahan sebagai kredensial akses sesi. |
| P2-02 | P2 | Defective implementation | Coverage WebSocket/API | Endpoint WebSocket assessor memvalidasi tanda tangan dan tenant JWT tetapi tidak memvalidasi role assessor/admin, sehingga role lain yang punya JWT tenant dapat membaca progres sesi. |
| P2-03 | P2 | Defective implementation | AI credential/logging | Resumption handle Gemini yang disimpan untuk pemulihan sesi juga ditulis utuh ke log level debug. |
| P2-04 | P2 | Defective implementation | Analyzer/Sidekiq | Worker menerima `turn_number` tetapi menganalisis enam giliran terbaru saat dieksekusi; job tertunda dapat memproses jendela yang sama berulang dan menaikkan probe_count palsu. |
| P2-05 | P2 | Defective implementation | Kontrak API–React | API mengirim `expected_level`, sedangkan tabel React membaca `required_level`; level yang disyaratkan lowongan tampil kosong pada laporan fit-gap. |
| P2-06 | P2 | Defective implementation | UI kandidat | Tautan/token invalid dan beberapa kegagalan koneksi ditampilkan sebagai “Interview Complete” dan menyatakan wawancara telah direkam. |
| P2-07 | P2 | Defective implementation | WebSocket/reconnect | Jumlah retry audio di-reset setiap kali socket terbuka, sehingga koneksi yang berulang kali putus setelah tersambung dapat retry tanpa batas. |
| P2-08 | P2 | Defective implementation | Onboarding assessor/auth | UI signup tidak dirutekan, endpoint `/signup` tidak ada, login hanya menerima role admin, dan model user tidak mendefinisikan role assessor; pengguna produk tidak memiliki onboarding/role workflow yang koheren. |
| P2-09 | P2 | Defective implementation/config | Local setup API–web | Default port API/WS di client dan `.env.example` adalah 3000, sedangkan API README/server berjalan di 3001; setup dari contoh dapat gagal sebelum alur produk bisa dipakai. |
| P2-10 | P2 | Defective implementation + missing specification | Pemeriksaan koneksi kandidat | Pemeriksaan jaringan bergantung pada CDN/echo service pihak ketiga, mengirim payload upload uji sekitar 0,5 MB, dan memblokir mulai dengan ambang keras tanpa jalur alternatif yang ditentukan. |
| P2-11 | P2 | Defective implementation | UI error/loading | Kegagalan fetch awal pada laporan portfolio/fit-gap/invite sering ditelan dan berakhir sebagai layar kosong tanpa pesan, retry, atau tindakan pemulihan. |
| P2-12 | P2 | Defective implementation | API/data scale | Endpoint sesi tidak dipaginasi dan index assessment memuat seluruh sesi setiap assessment untuk mencari sesi terbaru, sehingga waktu/memori tumbuh mengikuti semua histori. |
| P2-13 | P2 | Missing specification | Audit keputusan | Override assessor hanya menyimpan satu nilai terkini per skill; perubahan sebelumnya tidak membentuk histori yang dapat diaudit untuk menjelaskan keputusan hiring. |
| P2-14 | P2 | Missing specification | Keputusan kandidat/UU PDP | Tidak ada spesifikasi produk eksplisit mengenai batas penggunaan rekomendasi AI, review manusia wajib, keberatan, atau akomodasi/asesmen alternatif kandidat. |
| P2-15 | P2 | Missing specification | Verification | API tidak memiliki spec dan frontend tidak memiliki test runner/CI; regresi tenant isolation, keputusan, retry, dan seam API–UI belum terkunci oleh tes otomatis. |
| P3-01 | P3 | Defective implementation | Candidate hardware check | Pemeriksaan OS/browser selalu menyatakan lulus tanpa menggunakan hasil deteksi untuk menentukan kompatibilitas. |
| P3-02 | P3 | Defective implementation | UI routing | Tidak ada halaman fallback untuk URL SPA yang tidak dikenal, sehingga route salah dapat menghasilkan tampilan kosong. |

## Temuan rinci dan bukti

### P1 — Prioritas tertinggi

#### P1-01 — Header login memungkinkan pemilihan tenant tanpa otorisasi keanggotaan

**Jenis:** defective implementation. **Area:** `api/app/controllers/api/v1/authentication_controller.rb`, `api/app/auth/authorize_api_request.rb`, `api/app/middlewares/tenant_resolver_middleware.rb`.

`AuthenticationController#resolve_scheme` menggunakan `X-Tenant-Scheme` langsung ke claim JWT. Model `User` tidak menyimpan tenant/membership dan login tidak memastikan user berhak pada scheme tersebut. Request berikutnya memilih `Current.tenant_id` dari claim itu, lalu `TenantScoped` menggunakannya untuk query. Dengan demikian, tanda tangan token sah tidak membuktikan user berhak atas tenant dalam claim.

**Impact:** kredensial user dari satu organisasi berpotensi dipakai untuk menerbitkan token organisasi lain; ini meruntuhkan isolasi tenant lintas assessment, vacancy, dan sesi. Perbaikan di level resource saja tidak cukup—identitas dan membership harus menjadi sumber tenant yang tepercaya.

#### P1-02 — Portfolio, report, skill dan override tidak tenant-scoped

**Jenis:** defective implementation. **Area:** `api/app/models/portfolio.rb`, `api/app/models/portfolio_skill.rb`, `api/app/models/fit_gap_report.rb`, `api/app/models/assessor_override.rb`, `api/app/controllers/api/v1/portfolios_controller.rb`, `api/app/controllers/api/v1/portfolio_skills_controller.rb`.

Berbeda dengan `Assessment`, `Session`, dan `Vacancy`, model portfolio dan resource turunannya tidak menyertakan `TenantScoped`. Beberapa endpoint mengambil `Portfolio.find(params[:id])` atau `PortfolioSkill.joins(:portfolio).find(params[:id])` tanpa mengikat query pada tenant dari sesi induk. Endpoint yang terpengaruh termasuk fit-gap, ekspor, regenerate, report, dan override.

**Impact:** setelah memperoleh JWT assessor tenant mana pun, tebakan/ID portfolio dapat membuka evidence, ringkasan skill, dan data hasil kandidat tenant lain atau mengubah ratingnya; ini merupakan risiko kerahasiaan dan integritas data rekrutmen.

#### P1-03 — Pemeriksaan perangkat meminta mikrofon sebelum mulai dan tidak menghentikan stream microphone-only

**Jenis:** defective implementation. **Area:** `web/src/components/HardwareCheck.tsx`, `web/src/pages/interview/InterviewPage.tsx`.

`HardwareCheck` menjalankan pemeriksaan otomatis setelah halaman dimuat, lalu memanggil `getUserMedia({ audio: true })` sebelum tombol mulai. Jika kamera tidak diwajibkan, stream tidak disimpan pada state/ref; cleanup hanya menghentikan `videoStream`. Audio meter juga memasang `requestAnimationFrame` rekursif tanpa menyimpan/membatalkan frame. Jalur wawancara kemudian meminta stream mikrofon kedua melalui `useAudioCapture`.

**Impact:** kandidat dapat ditanya izin mikrofon sebelum memilih memulai dan capture pemeriksaan bisa terus berjalan setelah komponen ditinggalkan; ini merusak kendali kandidat dan transparansi pemrosesan suara. Stream pemeriksaan tersebut tidak tampak dikirim ke WebSocket, jadi audit ini tidak menyimpulkan suara itu dikirim ke Gemini.

#### P1-04 — Coverage dapat dinaikkan tanpa bukti, lalu memengaruhi confidence

**Jenis:** defective implementation. **Area:** `api/app/workers/coverage_analyzer_worker.rb`, `api/app/services/coverage/state_engine.rb`, `api/app/services/portfolios/generator.rb`.

`CoverageAnalyzerWorker#advance_stale_partials` langsung menetapkan `covered` untuk skill `partial` dengan `probe_count >= 4`, tanpa memeriksa bukti transkrip atau menjalankan aturan bukti analyzer. Portfolio generator memakai kombinasi `probe_count >= 3` dan `covered` sebagai dasar confidence tinggi. Selain itu, prompt portfolio meminta level bagi setiap skill pada coverage map (termasuk yang mungkin belum dibahas); kode tidak memvalidasi bahwa skill mempunyai kutipan kandidat yang cukup atau mempertahankan status tidak terukur sebagai hasil akhir.

**Impact:** kandidat bisa memperoleh label “covered/high confidence” atau level untuk kompetensi yang sebenarnya kurang/tidak dinilai; hiring team menerima sinyal lebih pasti daripada bukti yang tersedia. PRD 01 meminta confidence didasarkan pada evidence kandidat yang dapat dipertanggungjawabkan.

#### P1-05 — Polling laporan fit-gap menghasilkan job Gemini duplikat

**Jenis:** defective implementation. **Area:** `web/src/pages/fitgap/FitGapReportPage.tsx`, `api/app/controllers/api/v1/portfolios_controller.rb`, `api/app/workers/fit_gap_generator_worker.rb`.

Saat GET report mendapat 404, React mengirim POST untuk antrekan fit-gap. Selama job berjalan tidak ada record/status `generating` yang dibuat; GET berikutnya tetap 404. Karena halaman mem-poll tiap lima detik, tiap poll mengantrekan job baru sampai satu job menyimpan report. Endpoint API hanya mengembalikan report cache jika record sudah ada.

**Impact:** satu tampilan laporan dapat memicu banyak panggilan model yang sama, meningkatkan biaya/waktu antre, dan membiarkan worker saling menimpa hasil.

#### P1-06 — APP_BASE_URL deployment menunjuk host API, bukan aplikasi kandidat

**Jenis:** defective implementation/config. **Area:** `api/app/models/session.rb`, `api/README.md`, `api/k8s/configmap.yaml`, `web/src/App.tsx`, `web/vercel.json`.

`Session#invite_url` membuat `{APP_BASE_URL}/interview/{token}`. README menyebut `APP_BASE_URL` sebagai backend base URL; konfigurasi Kubernetes mengisinya dengan `https://ai-interview-api.rakamin.com`, yang ingress-nya meneruskan root ke service Rails port 3001. Route kandidat `/interview/:token` berada di SPA React/Vite, bukan route API. Pada konfigurasi yang tertulis, URL undangan mengarah ke host/API yang tidak menyajikan SPA.

**Impact:** kandidat menerima tautan yang dapat berakhir 404 dan tidak bisa memulai asesmen. Perlu verifikasi host frontend produksi aktual sebelum deployment.

#### P1-07 — Spesifikasi notice, hak kandidat, retensi dan pemusnahan data tidak ada

**Jenis:** missing specification. **Area:** alur kandidat, schema dan endpoint API.

Produk menyimpan nama/ID kandidat, transkrip teks per giliran, evidence, ringkasan, rating, confidence, override, dan hasil fit-gap. Transkrip dikirim ke layanan Gemini untuk analisis/portfolio; audio dikirim lewat Gemini Live. Dalam alur yang diaudit, UI tidak menunjukkan siapa pengendali, tujuan dan jenis data, penerima/pemroses, retensi, kontak privasi, atau cara meminta akses/koreksi/penghapusan/pembatasan. Tidak ditemukan lifecycle retensi/pemusnahan transkrip dan inferensi atau endpoint kandidat untuk mengajukan hak.

**Impact:** tim tidak dapat membuktikan kandidat memahami pemrosesan atau menangani hak dan penghapusan secara konsisten; risiko dan kewajiban aktual perlu dinilai oleh controller/legal, terutama karena hasil merupakan evaluasi kandidat. UU PDP memuat dasar pemrosesan dan kewajiban transparansi, akses/koreksi, pencatatan, penilaian dampak untuk pemrosesan berisiko tinggi, keamanan, dan transfer lintas negara; penggunaan persetujuan bukan satu-satunya dasar yang mungkin. [UU PDP Pasal 20–22](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/), [Pasal 30–39](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/), [Pasal 56](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/).

#### P1-08 — Evidence AI tidak diverifikasi dan konteks kandidat tidak dibatasi sebagai data tak tepercaya

**Jenis:** defective implementation. **Area:** `api/app/services/portfolios/generator.rb`, `api/app/services/fit_gap/engine.rb`, `api/app/controllers/api/v1/portfolios_controller.rb`.

Portfolio prompt memasukkan transkrip penuh tetapi tidak membatasi instruksi yang mungkin terkandung dalam ujaran kandidat sebagai data tak tepercaya (berbeda dengan prompt Analyzer yang eksplisit melakukannya). Output model kemudian disimpan: kutipan evidence tidak dicocokkan dengan giliran kandidat yang tersimpan, `ai_level` hanya di-clamp ke 1–5, dan narasi fit-gap menggunakan competency summary yang juga berasal dari model. Tidak ada validasi bahwa kutipan benar-benar diucapkan kandidat, terkait skill yang dinilai, atau menyokong levelnya.

**Impact:** manipulasi percakapan atau halusinasi model dapat menjadi “bukti” dan narasi rekomendasi yang tampak faktual, lalu memengaruhi keputusan kerja tanpa jejak verifikasi sumber.

### P2 — Dampak penting, terbatas atau bergantung konfigurasi

#### P2-01 — Token undangan bearer memiliki masa hidup tidak ditentukan dan berada di URL WebSocket

**Jenis:** defective implementation + missing specification. **Area:** `api/app/models/session.rb`, `api/app/channels/audio_websocket_middleware.rb`, `api/app/controllers/api/v1/sessions_controller.rb`, `web/src/hooks/useAudioWebSocket.ts`.

Token disimpan sebagai string 64 karakter dan dipakai sebagai otorisasi untuk membuka sesi via `?token=`; model tidak memiliki expired/revoked-at. Candidate `candidate_info` dan `audio_complete` juga menerima token tanpa JWT. Token di query dapat tercatat pada access log/proxy/telemetri bila konfigurasi mencatat URL lengkap. Status ended mencegah koneksi ulang sesudah sesi berakhir, tetapi bukan masa hidup undangan pending.

**Impact:** kebocoran tautan dapat memberi akses memulai/berinteraksi dengan sesi sampai status berubah; perlu TTL, revokasi, penggunaan minimum, redaksi log, dan strategi auth WebSocket yang aman. Ini potensi eksposur, bukan bukti log produksi telah menyimpan token.

#### P2-02 — Coverage WebSocket tidak memeriksa role JWT

**Jenis:** defective implementation. **Area:** `api/app/channels/coverage_websocket_middleware.rb`.

`authenticate_assessor_by_token` memverifikasi JWT dan mencocokkan tenant/session, tetapi tidak menjalankan pemeriksaan role yang setara dengan `authorize_auth_token! :assessor` pada API REST.

**Impact:** token bertanda tangan valid untuk role tenant yang bukan assessor dapat menerima peta progres sesi lewat WebSocket, jika token semacam itu diterbitkan oleh issuer.

#### P2-03 — Gemini resumption handle dicatat dalam log debug

**Jenis:** defective implementation. **Area:** `api/app/clients/gemini/live_client.rb:445–450`.

Seluruh object `sessionResumption` ditulis ke log debug sebelum handle disimpan ke kolom sesi. Object itu memuat resumption handle/token. Log lokal debug atau deployment yang menaikkan log level dapat menyimpan kredensial konteks sesi.

**Impact:** log aggregator atau log developer dapat menjadi salinan tambahan credential sesi; redaksi harus dilakukan sebelum logging.

#### P2-04 — Job analyzer memakai transkrip terbaru, bukan giliran yang memicu job

**Jenis:** defective implementation. **Area:** `api/app/workers/coverage_analyzer_worker.rb`, `api/app/services/coverage/analyzer.rb`.

Worker menerima `turn_number` namun hanya mencatatnya; Analyzer membaca `.last(6)` saat job berjalan. Bila antrean terlambat atau worker paralel, job untuk giliran lama dapat menganalisis enam giliran terbaru yang sama. Batas `+1` probe diterapkan per eksekusi, bukan idempotency key per giliran/jendela.

**Impact:** jendela percakapan yang sama dapat dihitung sebagai probe berulang dan mempercepat coverage/confidence secara keliru.

#### P2-05 — Nama field API dan frontend fit-gap berbeda

**Jenis:** defective implementation. **Area:** `api/app/services/fit_gap/engine.rb:58–66`, `web/src/components/fitgap/ComparisonTable.tsx:48–56`, `web/src/types/index.ts`.

API mengirim `expected_level`; komponen dan tipe React mengakses `required_level`. Backend juga tidak mengirim `is_override`, padahal komponen mencoba menggunakannya. Tabel menampilkan kolom “Required” tanpa angka dan tidak dapat menandai baris yang berasal dari override.

**Impact:** assessor kehilangan konteks pembanding utama untuk memahami “gap/match/exceed”, sehingga laporan tidak cukup membantu keputusan.

#### P2-06 — Error kandidat disajikan sebagai selesai/terekam

**Jenis:** defective implementation. **Area:** `web/src/pages/interview/InterviewPage.tsx:42–52, 229–240`, `web/src/hooks/useAudioWebSocket.ts`.

Kegagalan `candidate_info` mengubah state menjadi `complete`; state tersebut menampilkan “Interview Complete” dan “The interview has been recorded.” Uji token palsu pada browser menghasilkan tampilan itu. WebSocket juga mengubah koneksi yang gagal setelah retry menjadi `complete`.

**Impact:** kandidat dapat mengira undangan atau wawancara berhasil padahal tidak ada sesi yang berlangsung/terekam, sehingga tidak tahu cara meminta bantuan.

#### P2-07 — Retry audio dapat terus berulang setelah socket sempat terbuka

**Jenis:** defective implementation. **Area:** `web/src/hooks/useAudioWebSocket.ts:46–49, 119–130`.

Counter retry direset pada setiap `onopen`. Siklus “berhasil tersambung lalu putus” selalu kembali ke percobaan pertama; batas tiga percobaan tidak membatasi rangkaian putus yang berulang.

**Impact:** kandidat dapat terjebak reconnect tanpa batas/akhir yang jelas alih-alih mendapat state gagal dan bantuan.

#### P2-08 — Signup dan role assessor tidak konsisten

**Jenis:** defective implementation. **Area:** `web/src/App.tsx`, `web/src/pages/auth/SignupPage.tsx`, `web/src/services/auth.ts`, `api/config/routes.rb`, `api/app/controllers/api/v1/authentication_controller.rb`, `api/app/models/user.rb`.

`SignupPage` memanggil `/signup`, tetapi route API dan route SPA tidak didefinisikan. Login hanya menerima `admin`; model `User::ROLES` adalah `admin,user`, sedangkan middleware menyebut `assessor` sebagai role yang diterima API. Produk tidak memiliki alur membuat/menetapkan assessor dan membership tenant.

**Impact:** organisasi tidak bisa onboard assessor lewat UI dan kontrol akses produk tidak menggambarkan peran pengguna sebenarnya.

#### P2-09 — Default URL web tidak sesuai port API yang didokumentasikan

**Jenis:** defective implementation/config. **Area:** `web/src/services/api.ts:4–5`, `web/.env.example:1–5`, `api/README.md:29–30`, `api/config/puma.rb`.

Client dan contoh `.env` menunjuk `localhost:3000`, sedangkan API dijalankan di port 3001 menurut konfigurasi/README. File `.env` lokal yang telah disetel dapat menutupi mismatch ini.

**Impact:** developer baru yang mengikuti contoh dapat melihat kegagalan REST dan WebSocket walaupun kedua server berjalan.

#### P2-10 — Network pre-check mengirim traffic ke layanan pihak ketiga dan menjadi gerbang keras

**Jenis:** defective implementation + missing specification. **Area:** `web/src/utils/internetSpeedTest.ts`, `web/src/components/HardwareCheck.tsx`.

Ketika endpoint khusus tidak dikonfigurasi, ping/download memakai Google/CDN dan upload mencoba httpbin/Postman Echo dengan blob sekitar 0,5 MB; hasil ambang (8 Mbps down, 4 Mbps up, 300 ms) wajib lulus sebelum kandidat bisa mulai. Tidak ada spesifikasi tentang vendor/telemetri, kesalahan pengukuran, browser offline tetapi sesi masih mungkin, atau fallback non-audio.

**Impact:** alamat IP dan karakteristik koneksi kandidat diketahui pihak ketiga, sementara tes yang bergantung pada CDN/CORS dapat menghalangi kandidat karena sinyal jaringan, bukan kemampuan kerja.

#### P2-11 — Kegagalan pemuatan halaman berakhir tanpa pemulihan yang jelas

**Jenis:** defective implementation. **Area:** `web/src/pages/fitgap/FitGapReportPage.tsx`, `web/src/pages/portfolio/PortfolioPage.tsx`, `web/src/pages/assessments/AssessmentInvitePage.tsx`.

Beberapa efek fetch hanya menjalankan `.finally()` tanpa `.catch()` atau state error; bagian lain menelan error dengan `catch(() => {})`. Fit-gap menelan error selain 404 tanpa pesan. State akhirnya dapat menjadi halaman kosong atau informasi sebagian.

**Impact:** assessor tidak dapat membedakan belum ada hasil, gangguan API, akses ditolak, dan laporan gagal dibuat.

#### P2-12 — Histori besar dimuat tanpa paginasi di jalur sesi

**Jenis:** defective implementation. **Area:** `api/app/controllers/api/v1/sessions_controller.rb#index`, `api/app/controllers/api/v1/assessments_controller.rb#index`.

Index sesi mengembalikan seluruh sesi assessment. Index assessment memuat asosiasi semua sesi dan memilih latest dengan `max_by` di Ruby.

**Impact:** assessment dengan histori banyak memperbesar query/memori, memperlambat halaman dan dapat menghabiskan worker/API resource.

#### P2-13 — Histori perubahan penilaian assessor tidak tersimpan

**Jenis:** missing specification. **Area:** `api/app/models/assessor_override.rb`, `api/app/controllers/api/v1/portfolio_skills_controller.rb`.

Satu override per skill diperbarui di tempat. Ada `overridden_by`, `overridden_at`, dan catatan saat ini, namun tidak ada record append-only tentang rating/note lama atau alasan perubahan.

**Impact:** organisasi tidak dapat merekonstruksi bagaimana penilaian akhir berubah ketika kandidat/assessor mengajukan pertanyaan atau saat keputusan ditinjau.

#### P2-14 — Aturan human review, keberatan, dan akomodasi belum didefinisikan

**Jenis:** missing specification. **Area:** keseluruhan workflow kandidat dan hasil assessor.

Portfolio menyediakan override, tetapi tidak ditemukan kebijakan eksplisit apakah manusia wajib menyetujui hasil, siapa yang dapat menolak kandidat, bagaimana keberatan atas evaluasi diproses, atau alternatif bagi disabilitas/kendala bahasa, perangkat, dan koneksi. UU PDP Pasal 10 memberi hak keberatan pada keputusan yang hanya otomatis dan berdampak hukum/signifikan; Pasal 34 memasukkan scoring/evaluasi sistematis dan teknologi baru sebagai indikator risiko tinggi. Penerapan hukum tetap bergantung pada bentuk keputusan aktual. [UU PDP Pasal 10 dan 34](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/).

**Impact:** reviewer dapat memperlakukan saran model sebagai keputusan final dan kandidat tidak memiliki jalur yang jelas saat proses tidak adil/tidak dapat diakses.

#### P2-15 — Tidak ada harness tes otomatis

**Jenis:** missing specification. **Area:** `api/spec/`, `web/package.json`, CI repository.

Pemeriksaan repo menunjukkan belum ada spec API, test runner frontend, atau workflow CI. Ini juga dicatat brief sebagai baseline yang harus ditangani untuk membuktikan perubahan. Audit ini tidak menjalankan test suite.

**Impact:** perilaku sensitif seperti tenant isolation, status kandidat, keandalan job async, dan kecocokan payload belum dilindungi dari regresi.

### P3 — Polish atau dampak rendah

#### P3-01 — Pemeriksaan OS/browser selalu memberi status lulus

**Jenis:** defective implementation. **Area:** `web/src/components/HardwareCheck.tsx`, `web/src/utils/hardwareUtils.ts`.

Komponen memanggil `getBrowserInfo()` dan `getOSInfo()` tetapi membuang hasilnya, lalu menetapkan `osAndBrowser: PASSED` tanpa daftar kompatibilitas/cek API yang dibutuhkan.

**Impact:** label lulus memberi keyakinan palsu pada kandidat dengan browser yang tidak mendukung fitur audio.

#### P3-02 — Route SPA tak dikenal tidak punya halaman 404

**Jenis:** defective implementation. **Area:** `web/src/App.tsx`.

`Routes` tidak memiliki route wildcard/error page.

**Impact:** salah ketik URL menghasilkan area kosong tanpa petunjuk kembali.

## Missing specification vs defective implementation

### Missing specification (belum didefinisikan/dibuat)

1. Notice privasi, dasar/tujuan per pemrosesan, penerima/vendor, retensi dan lifecycle penghapusan; kontak serta workflow hak kandidat.
2. Kebijakan penggunaan AI dalam keputusan hiring: human review, keberatan, akomodasi, asesmen alternatif, dan perlakuan untuk kompetensi tidak terukur.
3. Identitas tenant dan keanggotaan organisasi untuk user, termasuk proses invitation/role assessor/admin dan lifecycle akun.
4. Retensi/revokasi tautan undangan, akses ulang dan kebijakan sesi kedaluwarsa.
5. Audit append-only untuk override/keputusan, beserta alasan dan histori.
6. Spesifikasi provider: lokasi pemrosesan, retensi, training, subprosesor, pemusnahan, dan peran Pengendali/Prosesor. Repo saja tidak membuktikan apakah transfer internasional atau pemenuhan kontrak vendor sudah aman.
7. Kriteria reliabilitas dan fallback untuk model gagal, hasil parsial, skill tidak dibahas, audio terputus, dan tes koneksi yang tidak akurat.
8. Kriteria aksesibilitas dan metode alternatif yang setara bagi kandidat dengan kebutuhan akses atau keterbatasan teknologi.
9. Acceptance criteria serta test harness backend/frontend dan pipeline CI untuk alur inti.

### Defective implementation (sudah ada tetapi salah/tidak aman)

1. Pemilihan tenant saat login tidak dibatasi membership; resource portfolio tidak mengikuti tenant scope.
2. Microphone pre-check terjadi sebelum tombol mulai dan stream microphone-only tidak memiliki cleanup eksplisit.
3. Coverage dipromosikan karena jumlah probe dan hasil portfolio tidak memiliki validasi evidence yang cukup.
4. Fit-gap polling mengantrekan ulang job yang belum selesai.
5. Tautan invite konfigurasi API host; default port web mengarah ke port API yang berbeda.
6. Token resumption ditulis ke log debug; token invite dikirim melalui query URL WebSocket.
7. Role check coverage WebSocket tidak konsisten dengan API REST.
8. Job analyzer mengabaikan giliran pemicu; retry audio di-reset tiap koneksi berhasil.
9. Kontrak field `expected_level`/`required_level` berbeda; status error kandidat dianggap sukses.
10. Signup tidak memiliki route dan role user tidak sejalan dengan role assessor.
11. Error pemuatan halaman, cek perangkat, dan tes koneksi memberi status/tindakan pemulihan yang tidak dapat dipercaya.

## Constraint Signal — eskalasi ke Tech Lead

1. **Isolasi tenant adalah risiko arsitektur P1.** Jangan menganggap `default_scope` saja sebagai batas keamanan. Auth harus mengikat akun pada membership organisasi, lalu semua resource turunan (portfolio, report, transcript/evidence, override, export dan WebSocket) harus memverifikasi kepemilikan sesi/tenant di query. Temuan P1-01 dan P1-02 independen; keduanya harus ditutup.
2. **Hiring score adalah keputusan berdampak tinggi.** Jalur coverage → transcript → portfolio → fit-gap saat ini dapat mengubah jumlah probe menjadi status covered dan mengandalkan output model tanpa validasi kutipan. Tetapkan kontrak evidence, unsupported/not assessed, confidence, reviewer approval, serta jejak audit sebelum menjadikan hasil sebagai rekomendasi operasional.
3. **UU PDP dan pemrosesan pihak ketiga perlu owner lintas fungsi.** Transkrip kandidat dipersistenkan dan audio/transkrip masuk layanan Gemini. Legal/privacy perlu menentukan controller/processor, dasar dan notice, DPIA, hak kandidat, retensi, transfer lintas negara, kontrak/subprosesor dan siapa petugas PDP bila kriteria berlaku. MK menafsirkan syarat penunjukan petugas Pasal 53 ayat (1) huruf b sebagai “dan/atau”, sehingga evaluasi tidak boleh mengasumsikan semua kondisi harus terpenuhi kumulatif. [Putusan MK 151/PUU-XXII/2024](https://www.mkri.id/perkara/persidangan/putusan?jenis=PUU&page=1&perPage=50&search=1%2FPUU-XXII%2F2024).
4. **Invite token adalah capability credential.** Rancang masa berlaku/revokasi, pembatasan sesi, throttling WebSocket/model cost, redaksi URL/log, dan pemulihan kandidat. Rack::Attack yang ada membatasi route REST candidate tetapi tidak pola `/ws/sessions/:id/audio`.
5. **Async model jobs perlu idempotency dan status eksplisit.** Fit-gap belum memiliki status generating sebelum worker menyimpan report, analyzer tidak memakai `turn_number`, dan retry/error UI tidak konsisten; efeknya biaya model dan evidence race sulit diaudit.
6. **Configuration contract memisahkan host aplikasi dan API.** Gunakan URL frontend untuk invite link, URL API/WS untuk service calls, dan satu sumber konfigurasi tervalidasi untuk local/staging/production. Nilai saat ini saling bertentangan antara README, `.env.example`, Puma, dan ConfigMap.

## Gap terhadap kondisi ideal

| Kondisi ideal | Kondisi yang ditemukan | Dampak terhadap workflow |
|---|---|---|
| Satu identitas sah hanya dapat mengakses data tenant yang menjadi haknya. | Tenant claim dapat dipilih dari header; portfolio/skill/report tidak tenant scoped. | Risiko data dan rating lintas organisasi. |
| Setiap rating dapat ditelusuri ke kutipan kandidat yang tervalidasi dan reviewer manusia. | Coverage bisa auto-promote berdasar hitungan; portfolio tidak memverifikasi evidence/level; override histori tidak ada. | Hasil tampak objektif tanpa provenance atau sejarah koreksi. |
| Kandidat paham pemrosesan, dapat memilih kapan memberi akses mikrofon, tahu error dan saluran haknya. | Mic permission dipicu pre-check; invalid link terlihat selesai; privacy/retention/help path tidak ditemukan. | Kehilangan kendali, kepercayaan dan kejelasan saat gagal. |
| Laporan async punya status yang stabil dan hanya satu job per permintaan. | Fit-gap polling berulang kali mengantrekan model call sebelum report tersedia. | Latensi/biaya dan race hasil. |
| Hasil fit-gap menampilkan persyaratan dengan benar dan menjelaskan skill belum dinilai. | `expected_level` tak terbaca oleh UI; output rating tidak memaksa status unassessed. | Hiring team bisa kehilangan pembanding atau salah membaca hasil. |
| Pengguna dapat menjalankan alur invite ke SPA pada semua environment. | APP_BASE_URL menunjuk host API; contoh client memakai port 3000 sedangkan server 3001. | Alur inti dapat berhenti sebelum kandidat masuk wawancara. |

## Asumsi dan hal yang belum dapat dipastikan

- P1/P2 adalah prioritas audit awal untuk Langkah 4, bukan penetapan liability hukum.
- Tidak ada reproduksi lintas tenant dengan dua akun/tenant produksi karena audit tidak memakai data/kredensial pihak lain. Risiko P1-01 diturunkan langsung dari alur penerbitan JWT dan resolver; P1-02 diturunkan dari query yang tidak tenant-scoped.
- Konfigurasi ConfigMap membuktikan nilai yang ditulis di repo, tetapi DNS/hosting produksi sebenarnya perlu dikonfirmasi.
- Token di URL berisiko tercatat pada infra yang menyimpan request URI; audit tidak memeriksa kebijakan logging pihak deployment.
- Wawancara AI nyata dan kualitas keputusan belum dapat dijalankan tanpa Gemini API key serta sesi sintetis khusus; model mungkin menangani sebagian kasus dengan baik, tetapi tidak ada jaminan validasi di server.
- UU PDP: dasar pemrosesan, status Pengendali/Prosesor, DPIA aktual, transfer vendor, dan penunjukan petugas harus dikonfirmasi oleh pemilik legal/privacy dengan fakta operasional deployment.
