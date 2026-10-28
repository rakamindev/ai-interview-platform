# Scope, acceptance criteria, dan prioritas submission

Tanggal keputusan: 27 Oktober 2026. Dokumen ini menjadi acuan scope laporan/PR dan menggantikan usulan lifecycle dalam `plan.md` sebagai scope implementasi yang diklaim. Ini finalisasi berdasarkan pekerjaan aktual dan evidence yang sudah ada, bukan klaim bahwa semua keputusan ditulis sebelum implementasi.

## 1. Masalah yang dipilih dan hasil yang dituju

**Masalah:** input kandidat dan perpindahan giliran audio tidak dapat diandalkan. Kandidat dapat berbicara tanpa transkrip/respons; membuka ulang sesi juga dapat meninggalkan mikrofon tertahan mute. Bukti kemampuan tidak dapat terkumpul dengan baik jika jalur input ini gagal.

**Hasil yang dituju:** perangkat siap sebelum sesi dibuka, PCM kandidat dipertahankan selama gilirannya, keluaran AI diputar, dan akhir giliran mengembalikan mikrofon dengan cleanup yang benar. Perilaku tersebut harus dapat diuji tanpa ketergantungan API key/model hidup, lalu diverifikasi secara terbatas melalui percakapan nyata.

Fokus ini dipilih karena memblokir workflow inti berulang kali, menyentuh frontend dan backend, dan memiliki regresi yang bisa direproduksi. Nilai yang dibuktikan adalah jalur input/output dapat bekerja pada skenario uji; belum ada pengukuran peningkatan akurasi hiring, conversion, atau waktu recruiter.

## 2. Yang masuk scope

| Bagian | Cakupan perubahan/hasil | Evidence |
| --- | --- | --- |
| Frontend audio | Startup capture/playback sebelum WebSocket, active worklet graph, gate mute, cleanup/cancel startup, indikator energi, pesan error startup perangkat | E01, E03, R01, R03, R05 |
| Backend giliran | Akhir model turn, flush transkrip, single gate callback, input pause dan watchdog yang tidak langsung menghitung durasi jawaban sebagai timeout | E02, R02, R04 |
| Resume sesi | Callback ready untuk sesi existing mengirim giliran kandidat | E02, R06, E06 |
| Integrasi pendukung | Koreksi endpoint REST generateContent dan dokumentasi pemilihan model/kuota untuk memulihkan portfolio lokal | R07, E07 dan metadata hasil |
| Runtime pengujian | Backend/worker Linux dengan TLS, pengecualian secret pada build, test harness frontend/backend dan smoke browser | setup.md; E01-E05 |
| Eksplorasi hasil | Memeriksa portfolio, fit/gap, dan isi PDF/JSON; mencatat cacat yang ditemukan | E07; F09-F12 |
| Bukti regresi | Red-green historis dan seeded fault di scratch branch dengan baseline/fault/revert | R01-R07; E06 |

Pembuktian alur sampai ekspor termasuk pengujian, bukan klaim bahwa engine penilaian/fit-gap telah diperbaiki. Penggantian nilai model adalah konfigurasi lokal yang dikelola pengguna; file secret tidak menjadi deliverable kode.

## 3. Yang tidak masuk implementasi saat ini

- Mengubah kontrak rating untuk skill belum dinilai, confidence, prompt penilaian, atau engine fit/gap (F09/F11, O01-O03).
- Merombak kesiapan portfolio dan lifecycle di seluruh layar assessor (F03). Outcome kandidat F01 kini masuk scope tambahan atas instruksi pengguna setelah M03 gagal; lihat reload-resume-fix.md.
- Mengubah threshold/metode internet (F05). Retry F02 dan perbaikan layout kini masuk scope tambahan E12/E13 atas instruksi pengguna.
- Memperbaiki kolom Required fit/gap atau membersihkan generation_error setelah sukses (F10/F12).
- Melakukan audit keamanan/legal lengkap, memperbaiki seluruh diagnostik token, atau menyatakan kepatuhan UU PDP (F08).
- Mengganti provider/transport audio, menambah speech recognition sendiri, atau mengubah schema data tanpa kebutuhan slice yang terbukti.

Tidak ada migrasi pada slice ini. Menyimpan perubahan schema yang tidak diperlukan akan memperluas risiko tanpa mengatasi akar gangguan audio. Kebutuhan representasi unassessed dalam backlog penilaian harus dievaluasi terpisah, termasuk kompatibilitas existing rows dan ekspor.

## 4. Acceptance criteria dan hasil sebenarnya

Status **lulus otomatis** berarti perilaku spesifik lulus dalam harness yang dicantumkan, bukan semua perangkat/browser. **Lulus terbatas** berarti skenario manual yang tersedia berhasil. **Belum** berarti belum ada evidence memadai. **Temuan terbuka** berarti perilaku tidak memenuhi kondisi ideal dan tidak boleh dilaporkan sebagai selesai.

| ID | Input/kondisi dan perilaku yang diterima | Status | Evidence/batas |
| --- | --- | --- | --- |
| AC01 | Start diklik saat izin perangkat asynchronous; WebSocket baru dibuka setelah capture siap dan playback disiapkan | Lulus otomatis | E01, R01 |
| AC02 | Context awal suspended dapat di-resume; input pada graph aktif menghasilkan PCM16 16 kHz non-hening | Lulus otomatis + browser sintetis | E01, E03; bukan mikrofon pengguna |
| AC03 | Suara pelan tidak diganti nol oleh filter volume lokal; seluruh frame hening tetap diteruskan ketika gate terbuka | Lulus otomatis pada processor asli | R05; gain/akurasi transkripsi perangkat nyata belum terukur |
| AC04 | Frame tidak diteruskan ketika mute; setelah unmute frame berikutnya dapat diteruskan; indikator tidak mengaku kandidat berbicara hanya karena mendapat giliran | Lulus otomatis + browser sintetis | E01/E03/R03; energi suara dapat berasal dari noise |
| AC05 | Playback PCM24 kHz dijadwalkan tanpa overlap antarchunk; callback kandidat menunggu antrean playback yang terjadwal | Lulus otomatis; render/drain browser lulus | E01/E03; sesi panjang dan timing lintasjaringan belum dibuktikan |
| AC06 | Permission/worklet gagal: koneksi interview tidak dibuka diam-diam, error perangkat terlihat, track/context yang sudah dibuat dilepas | Lulus otomatis | E01/R01; screenshot error UI belum direkam |
| AC07 | Stop/unmount/startup dibatalkan: resource dilepas dan callback playback terlambat tidak membuka kembali mikrofon | Lulus otomatis | E01; seluruh race reconnect belum diuji |
| AC08 | Model mengakhiri turn tanpa audio/generationComplete: buffer transkrip di-flush dan kandidat mendapat giliran; kombinasi completion tidak membuka gate dua kali | Lulus otomatis | E02/R02; fake transport |
| AC09 | Browser resume sesi existing: cleanup koneksi lama, handle fallback terbatas, dan sinyal kandidat | M03 baseline gagal; patch baru lulus tes deterministik E09 | E06 hanya snapshot callback lama; sesi 23 akhirnya dilanjutkan setelah intervensi, bukan bukti reload otomatis tanpa intervensi |
| AC10 | Input frame berhenti: akhir stream dikirim setelah jeda dari frame terakhir; frame baru menunda akhir stream; jawaban panjang tidak langsung memicu timeout model | Lulus otomatis | E02/R04; ini kontrak fallback saat frame berhenti, bukan bukti seluruh gaya bicara |
| AC11 | REST model preview membangun URL v1beta; respons JSON sintetis tetap diproses | Lulus otomatis | E02/R07; akses model/kuota bukan bagian tes offline |
| AC12 | Kandidat melakukan minimal tiga pasangan jawaban-respons nyata dan mengakhiri sesi | Lulus terbatas | Transkrip dan konfirmasi pengguna; video belum dikemas, endurance belum |
| AC13 | Setelah pemulihan integrasi, portfolio sesi uji tersedia; fit/gap dapat dibuka dan PDF/JSON menyertakan portfolio serta laporan vacancy yang sama | Lulus terbatas untuk availability/isi | Sesi 18/portfolio 18/vacancy 1, E07; belum menyatakan rating/metadata benar |
| AC14 | Perilaku inti resume yang sengaja dihilangkan ditangkap tes tanpa mengubah assertion, lalu dipulihkan | Lulus lokal | E06: 8/0 -> 8/1 -> 8/0; history telah dipush, lihat PR #214 |

### Batas yang tetap terbuka

| ID | Kondisi yang belum ditutup | Tindakan/verdict |
| --- | --- | --- |
| V01 | Live reconnect setelah gangguan jaringan, timing antargiliran kompleks, dan pengulangan lintassesi | Sebagian: M02b Force reconnect sempat pulih dan AI merespons; M03 baseline reload/resume gagal; sesi 23 akhirnya dilanjutkan terbatas setelah reconnect/mute/membuka ulang, bukan prosedur reload terisolasi; jaringan nyata tetap belum konklusif |
| V02 | Sesi 45 menit dan koneksi buruk | Belum; jangan menyebut endurance lulus |
| V03 | Mobile, long text, dan pemeriksaan visual semua halaman PDF | Sebagian: E13 16 skenario viewport Edge lulus setelah 8 gagal; Safari/ponsel fisik/semua halaman dan PDF export long text belum |
| V04 | Timeout/model close pada semua jalur UI, error/success lifecycle (F01) | F01 source/test diperbaiki pada E09; live setelah patch pending. Precheck mic Allow + reload lulus; Retry source/regression E12 dan browser fixture E13 lulus; izin perangkat nyata belum diuji ulang. Seluruh failure UX belum dinyatakan lulus |
| V05 | Concurrency/duplicate jobs, partial writes, otorisasi dan tenant untuk seluruh endpoint | Belum; tidak dinyatakan aman oleh suite audio |
| V06 | Unassessed rating dan gap (F09/F11), Required kosong (F10), error aktif tersisa (F12) | Temuan terbuka; tidak masuk klaim perbaikan |
| V07 | Riset domain, UU PDP, redaksi artefak, PR, video, dan publication history | Desk research domain/UU PDP dan draf PDF telah tersedia pada report-draft.md; lima screenshot live telah disanitasi (E10); PR #214 dan history telah dipublikasikan; video belum tersedia |

Tidak ada ambang akurasi/latency buatan atau klaim statistik dari satu sesi. Acceptance criteria di atas ditautkan ke pengamatan/test yang ada; beberapa dirapikan setelah investigasi berlangsung, sehingga laporan tidak boleh membalik urutan proses tersebut.

## 5. Prioritas temuan dan keputusan tindak lanjut

Severity menyatakan dampak jika kejadian terjadi; status/urutan tindak lanjut menyatakan apa yang dilakukan sekarang. Temuan yang sudah dipulihkan tidak menjadi backlog aktif hanya karena severity awalnya P1. Tidak ada P0 atau P3 yang dikonfirmasi; kategori tidak perlu diisi dengan temuan buatan.

| ID | Severity | Dasar dampak | Keputusan dan urutan |
| --- | --- | --- | --- |
| F07 | P1 | Jalur utama input/respons dapat terblokir | Fokus slice; source diperbaiki dan diverifikasi terbatas, V01/V02 tetap terbuka |
| F04 | P1 saat terjadi | Portfolio tidak tersedia, review terhenti | Integrasi lokal dipulihkan; perbaikan error lifecycle/kuota menyeluruh bukan selesai otomatis |
| F06 | P1 saat terjadi | Invite lokal menuju route yang tidak tersedia | Konfigurasi origin dipulihkan; panduan/config tetap perlu dirapikan untuk rilis |
| F09 + F11 | P1 | Tidak ada evidence ditafsirkan sebagai level rendah lalu gap terhadap vacancy | Backlog produk pertama; satu rantai masalah, jangan dihitung sebagai dua akar independen |
| F01 | P1 | Error teknis ditampilkan kepada kandidat sebagai sukses | Scope tambahan diimplementasikan; tes outcome/ack lulus E09, uji live pending |
| F08 | P2, cakupan terbatas | Token invite terlihat di log development | Investigasi keamanan segera sebelum log dipublikasikan/produk dirilis; dapat naik jika paparan/cakupan akses terbukti lebih luas |
| F02 | P2 | Tombol Retry hardware macet tetapi reload menjadi workaround lokal | Diperbaiki E12; 5 tes regression/31 suite dan built-UI fixture E13 lulus; pengujian perangkat nyata tetap terbatas |
| F10 | P2 | Assessor tidak melihat target untuk memeriksa delta | Koreksi kontrak expected_level/required_level pada pekerjaan lanjutan; nilai tersedia di ekspor |
| F12 | P2 | Status complete masih membawa error lama | Pekerjaan lanjutan untuk error aktif/riwayat attempt dan race job |
| F03 | P2 | Sesi berakhir disamakan dengan kesiapan hasil pada daftar | Ikuti pekerjaan lifecycle F01/F12 agar kontrak tidak terpecah |
| F05 | P2 | Internet check tidak menjelaskan batas/metode pemulihan | Evaluasi kebutuhan audio dan pengukuran sebelum mengubah threshold; localhost bukan bukti internet |
| O01-O03 | Observasi, belum severity | Sampel probing/confidence/transkripsi belum cukup untuk menetapkan cacat umum | Validasi coverage dan audio asli/data uji terkontrol; jangan menilai kandidat dari token transkripsi ambigu |

Urutan bukan alasan membiarkan token nyata masuk PR. Redaksi data pada paket submission tetap wajib dilakukan sekarang. Menyelesaikan semua backlog tidak menjadi scope take-home yang dipilih, tetapi reviewer harus dapat melihat apa yang sengaja belum ditutup.

## 6. Keputusan rilis dan arti selesai

**Submission scope:** menyajikan perbaikan fullstack audio dengan tes deterministik, seeded fault, bukti live terbatas, dan batas yang eksplisit. Implementasi inti dan evidence tersedia secara lokal; PR #214 dan history seeded fault telah dipublikasikan; paket belum final karena video belum tersedia. Lima screenshot live telah disanitasi sebagai E10; screenshot recovery pascaperbaikan belum tersedia. Desk research domain/UU PDP serta PDF review telah disusun; PDF final menunggu kelengkapan tersebut.

**Rilis ke client untuk keputusan hiring:** belum dapat direkomendasikan dari bukti ini. F09/F11 masih memengaruhi interpretasi hasil dan F01 belum diverifikasi live setelah patch, sementara pengujian keamanan, endurance, dan failure UX belum lengkap. Ini keputusan berbasis temuan yang sudah terlihat, bukan klaim bahwa semua area pasti bermasalah.

### Kriteria selesai untuk paket submission

- Scope, daftar perubahan, dan klaim hasil di PR/PDF mengacu pada AC01-AC14 dengan batas V01-V07.
- Seluruh source yang diklaim masuk commit dan dapat dijalankan reviewer; tidak ada secret atau data kandidat nyata.
- E01-E09 dan history seeded fault tersedia dari tautan GitHub yang benar.
- Screenshot menunjukkan UI sesungguhnya termasuk keadaan gagal/parsial dan responsif; video 3-5 menit menunjukkan alur utama.
- Konteks domain/UU PDP ditulis dengan sumber dan batas yang benar, lalu satu PDF final diperiksa sebelum diunggah.

Tidak mengubah kode produk atau menutup findings hanya dengan menulis dokumen ini. Perbaikan backlog baru memerlukan scope, test, dan verifikasi tersendiri.


## Review sebelum commit - 28 Oktober 2026

Review dua sumbu menemukan race pada manual End: reconnect membatalkan deadline acknowledgement dan dapat mengembalikan UI active setelah perangkat dihentikan. Regression test direproduksi gagal, lalu perbaikan mempertahankan ending hingga outcome terminal atau timeout. E11 merekam tes 26 frontend/18 backend serta build yang diperiksa ulang. E09 tetap snapshot historis 25/18, bukan ditimpa.

## Publikasi - 28 Oktober 2026

[PR fullstack #214](https://github.com/rakamindev/ai-interview-platform/pull/214) terbuka ke rakamindev/main. [Branch aplikasi](https://github.com/loma09/ai-interview-platform/tree/loma/project-setup) dan [scratch seeded fault](https://github.com/loma09/ai-interview-platform/tree/loma/seeded-fault-resume) telah dipush tanpa force push. Video belum tersedia.

## Scope tambahan Retry dan mobile - 28 Oktober 2026

- AC15: Retry mengulang checklist tanpa reload dan membersihkan resource/hasil async lama. E12: 5 merah -> 5 hijau, suite31. E13 juga menjalankan mic-denial -> Retry -> Start pada built UI dengan perangkat sintetis.
- AC16: Precheck/interview/portfolio/fit-gap pada 360/390/768/1280 px tidak memperlebar dokumen; kontrol utama terlihat dan tabel dapat discroll. E13: 8/16 gagal sebelum -> 16/16 lulus sesudah.
- Commit Retry terpisah dari commit mobile; batas perangkat nyata, F05 dan F10 tetap terbuka. Lihat hardware-retry-fix.md dan mobile-check.md.
