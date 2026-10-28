# Perbaikan reload/resume dan pesan akhir interview

27 Oktober 2026. Source sudah diperbaiki, tes deterministik lulus, dan patch aktif di API development. Update live: pengguna akhirnya mengonfirmasi sesi 23 dapat dilanjutkan; percobaan awal sempat macet dan melibatkan reconnect/mute. Lulus terbatas, bukan stabilitas semua reload.

## Masalah yang benar-benar terlihat

Pengguna me-reload interview tanpa menekan End Interview, tetapi halaman langsung menyatakan Interview Complete. Metadata sesi terbaru menunjukkan `ended/error`. Log yang disanitasi menunjukkan error awal Gemini 1011, kemudian handle resume berulang kali ditolak 1008 dengan alasan **BidiGenerateContent session not found or expired**. Gangguan model sudah terlihat sebelum browser disconnect, sehingga reload bukan satu-satunya penyebab yang terbukti.

Investigasi menemukan dua masalah yang saling memperburuk:

1. Backend mencoba ulang handle yang sudah ditolak. Browser disconnect juga meninggalkan koneksi model dan timer grace milik browser lama; timer itu bisa mengakhiri record sesi ketika halaman baru mencoba melanjutkan.
2. Frontend memetakan `ended`, load failure, error WebSocket terminal, dan habis retry menjadi tampilan sukses yang sama. Manual End Interview juga langsung mengaku complete sebelum konfirmasi server.

## Perubahan dan alasan

### 1. Reload melepas koneksi, bukan mengakhiri interview

Saat browser terputus, state koneksi ditandai detached, timer miliknya dibatalkan, dan client Gemini di-supersede lalu ditutup. Callback ready/close/retry milik koneksi lama diabaikan. Checkpoint terbaru disimpan saat detach, tanpa menunggu interval background write 60 detik.

Timer grace lama yang mengakhiri sesi setelah browser disconnect dihapus. Halaman baru dapat melanjutkan record active; waktu mulai asli tidak diubah. Jika batas waktu asli sudah lewat, koneksi baru diakhiri dengan `time_ceiling`, bukan mendapat 45 menit baru.

**Trade-off:** kandidat yang meninggalkan halaman dapat menyisakan record active. Tidak ada koneksi Gemini lama yang sengaja dipertahankan oleh alur detach ini, tetapi cleanup record abandoned secara durable belum ditambahkan. Batas waktu diperiksa ketika pengguna menyambung lagi. Ini belum solusi multi-tab/ownership lintas worker yang menyeluruh; jangan mengklaim concurrency aman dari pengujian single-session ini.

### 2. Handle expired punya satu jalur pemulihan yang berbeda

Jika API secara spesifik menolak handle yang dipakai dengan code 1008 dan alasan session not found/expired, backend membersihkan handle tersebut dan melakukan fresh connection dalam batas retry existing. Error model/policy lain tidak otomatis dianggap handle expired. Fallback tidak boleh menjadi retry loop tanpa batas.

Setelah koneksi fresh siap, maksimal 40 turn terakhir yang **sudah tersimpan** dikirim sebagai `clientContent` dengan role `model`/`user` dan `turnComplete: false`. Tidak mengarang jawaban kandidat atau memulai salam pembuka baru untuk percakapan existing. Jika history kosong, tidak ada percakapan yang dapat dipulihkan; kandidat tetap perlu berbicara untuk melanjutkan.

Checkpoint dengan `resumable: false` tidak dipertahankan. Log berisi payload handle resumption tidak lagi dicetak pada handler yang diubah. Ini tidak menutup F08 sepenuhnya: token invite masih bisa muncul pada path/SQL diagnostik lain yang belum diperbaiki.

**Batas:** audio in-flight dan transkrip yang belum disimpan belum tentu pulih. Context reconstruction bukan resumption provider yang identik. Pengujian langsung kualitas kelanjutan percakapan tetap diperlukan.

### 3. Status akhir kandidat sesuai hasil yang diketahui

API `candidate_info` kini menyertakan `end_reason` dan `remaining_seconds`. Frontend memakai alasan akhir yang diketahui, bukan sekadar status ended.

| Kondisi | Tampilan/tindakan baru |
| --- | --- |
| End normal yang dikonfirmasi: manual candidate/assessor, all_covered, time_ceiling | Interview Complete; copy hanya menyatakan sesi berakhir dan respons yang tersedia dapat direview |
| End reason error atau alasan lama tidak diketahui | Interview interrupted; hubungi hiring team, tidak mengklaim sesi sukses atau evidence lengkap |
| Data invite gagal dimuat | Unable to load interview; Try again untuk memuat status kembali |
| Browser ke API gagal tersambung setelah retry | Connection lost; Check session status sebelum melanjutkan |
| Manual End Interview dikirim | Ending interview...; tunggu session_ended dari server |
| End request tidak mendapat ack dalam 10 detik | Connection lost; status belum dapat dikonfirmasi, bukan sukses palsu |

Cleanup terminal menghentikan perangkat dan socket. Intentional close/unmount tidak memulai reconnect baru; event dari socket yang sudah diganti tidak mengubah UI. Kegagalan load atau koneksi yang belum jelas tidak otomatis diubah menjadi record sesi ended.

## File yang berubah

| File | Peran |
| --- | --- |
| `api/app/channels/audio_websocket_middleware.rb` | Cleanup detach, guard callback lama, fallback handle, restore history, batas waktu asli |
| `api/app/clients/gemini/live_client.rb` | Wire clientContent untuk history dan checkpoint non-resumable |
| `api/app/controllers/api/v1/sessions_controller.rb` | Contract end_reason/remaining_seconds |
| `web/src/utils/interviewOutcome.ts` | Daftar alasan akhir normal yang dipakai page dan hook WS |
| `web/src/hooks/useAudioWebSocket.ts` | Outcome error/normal/connection lost; intentional cleanup |
| `web/src/pages/interview/InterviewPage.tsx` | State load/error/end acknowledgement, retry status, cleanup perangkat dan tampilan |
| `web/src/types/index.ts` | Tipe kontrak dan state tambahan |

Tidak ada migrasi database, penggantian secret, perubahan akun, atau pembukaan ulang sesi ended/error. Spec resume lama kini memakai ConnectionState asli agar sesuai lifecycle baru; assertion sinyal kandidat tetap dipertahankan. Seeded-fault history sebelumnya tetap menjadi snapshot tahap sebelumnya, bukan evidence bahwa seluruh lifecycle baru dulu sudah diuji.

## Bukti sebelum/sesudah

| Pemeriksaan | Sebelum patch | Hasil terbaru |
| --- | --- | --- |
| Frontend outcome/recovery | 9 gagal, 15 lulus dari 24 tes | 25 lulus, exit 0 |
| Retry audio_complete setelah unmount | 1 gagal / 24 lulus pada tes tambahan | Lulus dalam suite final 25 tes |
| Backend lifecycle/API | 4 gagal, 9 lulus dari 13 contoh pada baseline | Suite final 18 contoh, 0 gagal, exit 0 |
| Checkpoint non-resumable | 1 gagal dari 15 contoh pada tahap tambahan | Lulus dalam suite final |
| TypeScript | Test awal sempat memakai Array.at yang tidak didukung target project; diperbaiki pada fixture | Exit 0; target tsconfig tidak diubah |
| Build | Tidak diklaim sebagai baseline red | Exit 0; envDir false |
| Edge: UI build sebenarnya, data sintetis | Tidak ada baseline screenshot otomatis | Error/sukses/load failure benar; 1280/390 px tanpa horizontal overflow |
| Edge: capture/playback sintetis | Existing smoke dipertahankan | PASS PCM16/mute/unmute/playback/drain |
| Aktivasi API lokal | Source lama | Hash tiga file host/container cocok; health ok |

Evidence raw: `reload-frontend-red.txt`, `reload-backend-red.txt`, `reload-checkpoint-red.txt`, `reload-unmount-red.txt`, `reload-frontend-green.txt`, `reload-backend-green.txt`, `reload-typecheck.txt`, `reload-build.txt`, `reload-ui-browser.txt`, dan `reload-audio-browser.txt` dalam `evidence/`. Hasil backend final dijalankan dari image yang baru dibangun dengan network none dan tanpa mount secret. Controller spec tidak boot Rails dan bukan audit authorization/middleware HTTP.

Screenshot sintetis: [interrupted mobile](evidence/reload-ui/failed-390.png), [interrupted desktop](evidence/reload-ui/failed-1280.png), [load error](evidence/reload-ui/load_error-390.png), [normal completion](evidence/reload-ui/complete-390.png). Ini tampilan aplikasi sebenarnya dengan respons sintetis; bukan screenshot percakapan live atau bukti semua halaman mobile sudah lulus.

## Cara menguji langsung setelah aktivasi

1. Gunakan invite **sesi baru**; jangan menghidupkan kembali sesi lama yang sudah ended/error. Refresh frontend agar source terbaru dipakai.
2. Mulai interview dan lakukan satu pertukaran jawaban-respons. Setelah AI selesai bicara, reload sekali tanpa End Interview.
3. Selesaikan precheck dari mount baru dan klik Start. Jika handle diterima, kandidat mendapat giliran. Jika handle ditolak secara spesifik, backend mencoba context reconstruction satu kali.
4. Ucapkan permintaan mengulang pertanyaan terakhir, lalu jawab. Periksa suara AI, transkrip baru, kelanjutan konteks, dan waktu yang tidak kembali 45 menit.
5. Klik End Interview. Layar baru menyatakan complete setelah server mengonfirmasi. Jika server gagal/ack tidak datang, UI tidak boleh mengaku sukses.
6. Undangan sesi lama yang berakhir karena error harus menunjukkan Interview interrupted. Jangan memakai sesi lama itu untuk menilai keberhasilan resume active-session.

Hasil live setelah patch: pengguna akhirnya mengonfirmasi sesi 23 dapat dilanjutkan. Pemulihan terakhir tidak direkam sebagai percobaan reload yang terisolasi; macet sebelumnya tetap dicatat. Detail pada evidence/manual-recovery-mobile.md bagian M03 lanjutan. Hasil ini tidak mengubah M03 baseline menjadi lulus atau membuktikan seluruh kriteria waktu/transkrip/konteks sudah terverifikasi.

## Penjelasan presentasi

> Saya awalnya hanya menguji pesan pengembalian giliran saat resume. Uji manual kemudian membuktikan seluruh alur masih gagal: provider menolak handle expired, koneksi lama masih punya timer, dan UI mengubah error menjadi sukses. Saya menambah tes pada lifecycle dan outcome, menghentikan pekerjaan koneksi lama saat detach, memberi fallback terbatas dari transkrip tersimpan, dan membuat UI menunggu alasan akhir/ack yang benar. Hasil otomatis lulus, tetapi percakapan nyata setelah patch tetap harus diuji. Saya tidak mengklaim semua audio yang belum tersimpan dapat dipulihkan atau cleanup abandoned-session sudah selesai.

Referensi protokol: [Google Live API session management](https://ai.google.dev/gemini-api/docs/live-api/session-management) dan [Live API capabilities](https://ai.google.dev/gemini-api/docs/live-api/capabilities). Ketersediaan model/layanan tetap ketergantungan eksternal.
