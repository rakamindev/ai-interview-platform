# Perbaikan audio wawancara - 27 Oktober 2026

## Status dan batas klaim

Perbaikan source telah diterapkan dan diuji secara deterministik pada frontend, protokol backend, serta browser Edge dengan audio sintetis. Image `ai-interview-api:local` sudah dibangun ulang. Uji percakapan live menggunakan mikrofon pengguna dan Gemini setelah patch masih diperlukan; dokumen ini tidak menyatakan masalah audio sudah selesai pada semua perangkat atau sesi.

Perubahan tidak membaca konfigurasi secret, tidak memakai API key Gemini untuk pengujian, dan tidak mengubah database. RSpec pada image final dijalankan dengan jaringan dimatikan. Server fixture browser menggunakan `envDir: false` dan tidak menghubungi API aplikasi. Bunyi sintetis memverifikasi pemrosesan Web Audio, bukan apa yang benar-benar didengar pada speaker/headset pengguna.

## Gejala awal

- AI sempat berinteraksi pada satu sesi, tetapi diam pada percobaan berikutnya.
- Ucapan kandidat tidak terlihat di transcript; teks AI kadang muncul.
- Log menunjukkan chunk audio diteruskan, silence pump aktif, dan reconnect setelah inactivity 30 detik.

Log pengiriman chunk hanya membuktikan ada byte yang dikirim. Itu tidak membuktikan input non-hening, autoplay terbuka, atau gate mikrofon sudah memberi giliran kandidat.

## Penyebab kode yang berhasil direproduksi

### 1. Startup WebSocket mendahului kesiapan mikrofon

`InterviewPage` sebelumnya menghubungkan WebSocket, menunggu izin/setup capture, lalu memanggil mute. Bila server lebih cepat mengirim giliran kandidat, penyelesaian setup mikrofon yang terlambat dapat memute kembali input. Status `active` juga sebelumnya membuka mute tanpa memperhatikan giliran speaker.

Perbaikan: inisialisasi capture dan playback dari klik Start, mute sebelum startup, tunggu kesiapan perangkat, lalu hubungkan WebSocket. Giliran kandidat membuka gate setelah antrean playback selesai; perubahan status koneksi sendiri tidak membuka gate.

### 2. AudioContext dan graph capture tidak dijamin aktif

Capture sebelumnya membuat context setelah menunggu izin perangkat, tidak melakukan resume eksplisit, dan tidak menghubungkan output worklet ke destination. Playback membuat context pertama kali ketika chunk WebSocket datang, di luar klik Start. Kondisi suspended/autoplay dapat membuat proses terlihat connected tetapi tidak menghasilkan suara.

Perbaikan: create/resume kedua context dimulai di klik Start. Worklet capture dihubungkan ke destination agar graph aktif; processor existing tidak menulis sample output, sehingga suara mikrofon tidak diputar kembali. Kegagalan setup melepaskan track/context dan menampilkan tindakan perbaikan perangkat sebelum sesi dibuka.

### 3. Akhir giliran model tertentu tidak membuka gate atau menyimpan input

`Gemini::LiveClient#handle_turn_complete` sebelumnya memperlakukan salah satu cabang sebagai giliran user. Padahal `serverContent.turnComplete` menandai akhir giliran model. Pada respons tanpa audio/generationComplete, callback pergantian giliran dapat tidak dipanggil. Pada audio yang berakhir tanpa generationComplete, buffer transcript kandidat tidak di-flush.

Perbaikan: akhir giliran mem-flush buffer kandidat dan AI, menghentikan silence pump, serta membuka gate tepat sekali. Bila generationComplete sudah menjadwalkan delay drain, delay itu dipertahankan agar tidak membuka input dua kali atau terlalu cepat.

### 4. Cleanup perangkat dan callback terlambat

Capture sebelumnya tidak melepaskan perangkat otomatis pada unmount atau kegagalan worklet. Callback menunggu playback dapat tetap membuka mikrofon setelah stop.

Perbaikan: cleanup hook menutup context/track, startup yang dibatalkan tidak mengaktifkan stream terlambat, dan stop playback membatalkan callback yang tertunda.

Penyebab di atas dibuktikan dengan controlled regression tests. Belum dibuktikan bahwa setiap gejala sesi pengguna disebabkan hanya oleh jalur tersebut; format audio perangkat, browser, layanan model, dan jaringan masih masuk batas live verification.

## Cakupan file

| Source | Perubahan |
| --- | --- |
| `web/src/hooks/useAudioCapture.ts` | Resume context, aktifkan graph, hasil startup boolean, cleanup |
| `web/src/hooks/useAudioPlayback.ts` | Prepare dari gesture, cancel callback, cleanup |
| `web/src/pages/interview/InterviewPage.tsx` | Startup perangkat sebelum koneksi, mute sesuai giliran, error perangkat yang dapat dicoba ulang |
| `api/app/clients/gemini/live_client.rb` | Penanganan turnComplete, flush transcript, gate satu kali |

Pengujian ditambahkan pada tiga file frontend, satu spec backend, helper RSpec, dan smoke script browser. Vitest/Testing Library/jsdom serta Playwright ditambahkan sebagai dev dependencies. Node lokal pengguna v24.21.0 mendukung toolchain pengujian ini; cek versi Node bila menjalankan pada mesin lain. Tidak ada migrasi database.

## Acceptance criteria yang diverifikasi

- [x] WebSocket tidak dibuka sebelum capture siap.
- [x] Context capture suspended dapat dilanjutkan dan mengirim PCM16 non-hening melalui graph aktif.
- [x] Tidak ada frame dikirim selama gate mute; frame berikutnya terkirim setelah giliran kandidat.
- [x] Playback dibuka dari interaksi Start dan chunk dijadwalkan berurutan.
- [x] Kegagalan izin/worklet tidak membuka sesi diam dan resource dibersihkan.
- [x] Unmount/stop melepaskan resource dan membatalkan callback playback yang terlambat.
- [x] Turn model tanpa audio tetap mengembalikan giliran ke kandidat.
- [x] Input transcript disimpan ketika audio berakhir tanpa generationComplete.
- [x] generationComplete dan turnComplete bersamaan tidak memanggil pergantian giliran dua kali.
- [x] Capture, mute, unmute, render playback, dan drain berfungsi pada Web Audio nyata dengan input sintetis di Edge.
- [ ] Uji live mikrofon pengguna: minimal tiga pertukaran jawaban/transcript/audio, kemudian end session.
- [ ] Uji live reconnect dan pengulangan di sesi baru tanpa menumpuk perangkat/koneksi.

## Hasil verifikasi

| Pemeriksaan | Baseline | Setelah perbaikan | Evidence |
| --- | --- | --- | --- |
| Suite frontend | 8 gagal, 1 lulus | 9 lulus | `evidence/audio-frontend-red.txt`, `evidence/audio-frontend-green.txt` |
| Spec protokol Gemini | 2 gagal, 1 lulus | 3 lulus | `evidence/audio-backend-red.txt`, `evidence/audio-backend-green.txt` |
| Edge/Web Audio sintetis | Tidak dijalankan pada baseline | PASS: PCM16 16 kHz non-hening, mute/unmute, render/drain 24 kHz | `evidence/audio-browser-green.txt` |
| TypeScript | Tidak dicatat sebagai red | Exit 0 setelah patch | Perintah pemeriksaan di bawah |
| Build Vite dengan `.env` dimatikan | Tidak dicatat sebagai red | Exit 0; build memakai config Vite repository | Perintah pemeriksaan di bawah |
| Image API Linux | Image lama sudah mendukung TLS | Build ulang exit 0; suite RSpec penuh 3 contoh, 0 gagal; TLS OK | Output build dan `audio-backend-green.txt` |
| Audit dependency setelah instalasi final | Versi awal test runner menambah advisory | npm melaporkan 0 vulnerabilities setelah update runner | Output instalasi; bukan audit keamanan aplikasi |

Hasil red diambil pada source baseline sebelum patch produk diterapkan. Awalnya harness juga mengalami masalah konfigurasi worker dan fake timer; keduanya diperbaiki terlebih dahulu sebelum output red final direkam. Ini membedakan kegagalan harness dari regression failure yang relevan.

### Menjalankan pengujian

Frontend:

```powershell
cd D:\ai-interview-platform\web
npm.cmd test
npm.cmd run test:audio-browser
```

Smoke script memakai Edge yang sudah terpasang pada Windows; sistem lain memerlukan Chromium Playwright. Semua data perangkat pada smoke test adalah sintetis.

Backend dari image final, tanpa mount konfigurasi lokal:

```powershell
docker run --rm --network none ai-interview-api:local bundle exec rspec --format documentation
```

Verifikasi build tanpa memuat `.env`:

```powershell
cd D:\ai-interview-platform\web
.\node_modules\.bin\tsc.cmd
node --input-type=module -e 'import { build } from "vite"; await build({ envDir: false });'
```

## Aktivasi lokal dan uji live

Update aktivasi: source LiveClient yang sudah diuji telah dipasang ke container API development dan API sudah direstart. Hash SHA-256 source host/container cocok; health endpoint kembali `ok`. Uji percakapan live setelah aktivasi masih menunggu pengguna.

Build image baru tidak otomatis mengganti filesystem container yang sudah berjalan. Untuk mengaktifkan patch backend pada container development existing, pengguna dapat menyalin satu source client lalu merestart API:

```powershell
cd D:\ai-interview-platform
docker cp api/app/clients/gemini/live_client.rb ai-interview-api:/ai-interview/app/clients/gemini/live_client.rb
docker restart ai-interview-api
```

Image sudah dibangun dengan source yang sama agar perubahan juga ada ketika container dibuat ulang dari image tersebut. Cara docker cp di atas hanya untuk aktivasi development; bukan mekanisme release production.

Restart Vite jika diperlukan setelah perubahan dependensi, refresh halaman kandidat, dan buat sesi baru. Dengan mikrofon/headset yang benar, jawab minimal tiga pertanyaan; periksa suara AI, transcript kandidat, dan perpindahan giliran. Jangan gunakan token undangan lama dari sesi yang sudah ended. Jika masih diam, ambil metadata input/output dan state context dari sesi baru tanpa menyalin key, token, atau transcript pribadi.

## AI verification moment

AI sempat menghasilkan fake timer Ruby dengan bentuk `def fire = callback.call unless cancelled`. Ruby menafsirkan modifier tersebut di luar body method sehingga test harness gagal dengan `NameError`, bukan kegagalan produk. Error diperiksa dan method diubah menjadi bentuk multiline. Setelah harness benar, baseline menunjukkan dua assertion failure yang relevan dan satu tes lulus; setelah patch, tiga spec lulus. Kasus ini menunjukkan mengapa error harness tidak boleh dihitung sebagai bukti regression test. Riwayat output ada di percakapan pengerjaan; source fake timer yang dikoreksi ada pada spec. Ini belum menggantikan seeded fault dengan riwayat Git pada scratch branch seperti diminta brief.

## Referensi teknis

- [Google Live API: server content dan turnComplete](https://ai.google.dev/api/live#BidiGenerateContentServerContent)
- [MDN: autoplay dan aktivasi AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- [MDN: AudioWorkletNode dan routing audio graph](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode)


## Panduan presentasi

Lihat [presentation-audio.md](presentation-audio.md) untuk penjelasan tiap file, istilah audio, trade-off, urutan demo, dan latihan technical defense.

## Update lanjutan: indikator dan akhir jawaban

Setelah patch awal, pengguna melaporkan satu pertukaran live berhasil (AI bertanya, kandidat menjawab, AI memberi follow-up). Pada jawaban berikutnya AI tetap diam setelah kandidat berhenti setidaknya lima detik. Ini bukti live parsial, bukan bukti seluruh masalah selesai.

### Indikator mikrofon

Label lama `You're speaking` berasal dari giliran kandidat, bukan pengukuran sample mikrofon. Indikator kini memakai RMS PCM pada hook capture: `Sound detected` ketika ada energi audio yang melampaui batas meter, `Your turn — microphone ready` ketika hening, dan `Microphone muted` ketika pengguna memute. Animasi berhenti setelah 250 ms tanpa frame berenergi yang cukup. Ini meter suara, bukan klasifikasi ucapan manusia; noise juga dapat memicunya. Perubahan meter tidak mengubah threshold filter worklet atau batas jaringan.

Tiga regression test tambahan gagal sebelum patch, lalu seluruh 12 tes frontend lulus. Bukti: `evidence/audio-indicator-red.txt` dan `evidence/audio-indicator-green.txt`. TypeScript, build Vite tanpa .env, serta browser smoke sintetis juga kembali lulus.

### Akhir stream input dan watchdog

Sebelumnya backend memompa sample hening sintetis ketika worklet berhenti mengirim. Perbaikan memakai `realtimeInput.audioStreamEnd=true` setelah satu detik tanpa frame input baru, sesuai mekanisme Live API dengan automatic VAD. Timer memeriksa timestamp frame terakhir sehingga frame yang datang di tengah window menunda finalisasi. Audio berikutnya dapat membuka stream kembali. Waktu satu detik mengikuti window jeda yang sudah ada; kesesuaiannya untuk berbagai pola bicara masih perlu diuji live.

Bug watchdog juga direproduksi: jawaban panjang bisa membuat waktu sejak aktivitas model sebelumnya melebihi 30 detik. Saat kandidat berhenti, watchdog bisa langsung memaksa reconnect sebelum model punya waktu menjawab. Waktu tunggu kini dimulai ulang saat sinyal akhir input dikirim; watchdog tetap melakukan recovery bila model benar-benar tidak merespons selama batas tunggu.

State internal bernama `waiting_for_response?` menggantikan `silence_pumping?`, dan pemanggil proactive reconnect pada `api/app/channels/audio_websocket_middleware.rb` diperbarui. Tidak ada lagi periodic silence pump untuk menandai akhir jawaban.

Tiga regression test tambahan membuktikan sinyal akhir jeda, tidak memotong input yang masih datang, serta timeout yang adil setelah jawaban panjang. Sebelum patch terdapat 3 gagal/3 lulus; sesudah patch full suite backend 6 contoh, 0 gagal. Bukti: `evidence/audio-pause-red.txt` dan `evidence/audio-pause-green.txt`.

Image API dibangun ulang. Source LiveClient dan middleware dipasang bersama ke container development; hash keduanya cocok dengan repository, API dimulai ulang, dan health kembali ok. Sidekiq serta database tidak diubah. Pengguna perlu refresh frontend dan memakai sesi baru untuk verifikasi live patch lanjutan ini.

Referensi: [Google Live API: audioStreamEnd](https://ai.google.dev/api/live#BidiGenerateContentRealtimeInput) dan [panduan hybrid VAD](https://ai.google.dev/gemini-api/docs/live-api/capabilities#hybrid-vad).

Batas klaim: sinyal akhir input hanya dapat dipicu setelah frame input benar-benar berhenti. Jika noise terus berada di atas ambang filter worklet, indikator dapat tetap menunjukkan Sound detected dan perlu investigasi perangkat/noise. Belum ada bukti live setelah patch lanjutan, sehingga stabilitas multi-turn tidak diklaim selesai.
## Koreksi lanjutan: jawaban pertama hilang dan resume tidak membuka mikrofon

Laporan uji manual terbaru: kandidat menjawab tetapi tidak mendapat transkrip/respons; restart frontend hanya membuat AI berbicara lagi. Status sebelumnya belum stabil dan tidak boleh dinyatakan selesai berdasarkan tes sintetis.

Bukti source dan tes processor asli:
- Filter RMS tetap 0.01 mengganti sampel suara pelan 0.005 menjadi nol. Sesudah tujuh frame hening, audio berhenti dikirim; durasi jeda tidak dipertahankan.
- Processor kini mengirim PCM asli secara kontinu selama gerbang mikrofon terbuka. Penilaian energi hanya untuk indikator; Gemini automatic VAD menerima suara pelan dan jeda lengkap. Tradeoff: sekitar 32 KB/detik PCM sebelum overhead saat giliran kandidat, termasuk hening.
- Pada koneksi browser baru ke sesi dengan resumption token, backend hanya mengirim session_started tanpa speaker_changed:candidate. Karena frontend memulai dalam keadaan mute, kandidat dapat tertahan. Jalur resume kini mengirim giliran kandidat secara eksplisit. Resume melanjutkan percakapan; tidak menjanjikan AI mengulang pertanyaan pembuka.

Pengujian: audio-worklet-red.txt menunjukkan dua kegagalan pada processor asli; audio-worklet-green.txt menunjukkan perbaikan. audio-resume-red.txt menunjukkan sinyal giliran kandidat hilang; audio-resume-green.txt menunjukkan 7 tes backend lulus. Ini tidak membuktikan seluruh kegagalan live berasal dari dua masalah tersebut; verifikasi 3 giliran percakapan nyata masih wajib.

Referensi: https://ai.google.dev/gemini-api/docs/live-api/capabilities (PCM dan automatic voice activity detection).

## Portfolio: model preview dan versi endpoint

Sidekiq mengembalikan Gemini HTTP 404 berulang ketika menghasilkan portfolio. Pengguna mengonfirmasi model non-rahasia gemini-3.1-pro-preview. Source HttpClient memakai /v1, sedangkan contoh REST resmi model tersebut memakai /v1beta. Endpoint bersama dikoreksi ke /v1beta; ini juga memengaruhi caller REST Gemini lainnya.

Tes transport sintetis lewat generate_content menangkap URL aktual: sebelum perubahan 1 gagal/7 lulus; sesudah perubahan 8 lulus. Bukti ada pada evidence/portfolio-endpoint-red.txt dan portfolio-endpoint-green.txt. Tidak menggunakan API key asli dalam tes. API dan Sidekiq menerima source endpoint terbaru dan direstart. Keberhasilan portfolio nyata masih menunggu Retry oleh pengguna; akses model, quota, dan validitas respons belum dibuktikan hanya dengan tes URL.

Sumber: https://ai.google.dev/gemini-api/docs/generate-content/gemini-3

## Verifikasi setelah endpoint portfolio dikoreksi

Retry dari frontend diterima PortfoliosController#regenerate (HTTP 200), lalu PortfolioGeneratorWorker benar-benar berjalan. Error terbaru berubah dari HTTP 404 menjadi Gemini::HttpClient::RateLimitError: Rate limited. Ini menunjukkan hambatan terbaru terkait batas request/quota provider, bukan mutu jawaban kandidat. Belum diketahui dari bukti yang disanitasi apakah batas per menit, harian, token, atau kuota proyek. Perlu pemeriksaan dashboard quota oleh pemilik akun. Jangan menyatakan portfolio berhasil atau menyarankan membeli quota tanpa verifikasi.

Perintah diagnosis sebelumnya hanya mencakup ApiError/TimeoutError dan tidak menangkap nama subclass RateLimitError. Karena itu output kosong bukan bukti tidak ada error. Gunakan metadata start/fail worker dan sertakan RateLimitError dalam filter berikutnya.

## Bukti hasil portfolio sesi 18

Pemeriksaan read-only PostgreSQL pada schema ai_interview mengonfirmasi portfolio session_id=18 berstatus complete, generated_at=2026-10-27 11:54:13 UTC, dan memiliki 3 baris portfolio_skills. Ini membuktikan penyimpanan hasil setelah pergantian konfigurasi model berhasil. Isi penilaian tidak diambil dalam pemeriksaan metadata ini. Tampilan browser dan kualitas penilaian masih harus diverifikasi terpisah. generation_error masih berisi nilai lama walaupun status complete; generator belum membersihkannya saat sukses (calon perbaikan terpisah).

## Update seeded fault
Eksperimen seeded fault terpisah kini selesai secara lokal. Lihat seeded-fault.md dan evidence E06: baseline 8/0, fault 8/1, restore 8/0, dengan commit baseline/fault/revert dan file tes identik. Pernyataan lama bahwa seeded fault belum dikerjakan adalah status pada tahap investigasi sebelumnya. Publikasi branch/history untuk reviewer eksternal masih belum dilakukan.

## Update scope: perbaikan reload/resume dan outcome kandidat
Setelah M03 gagal, pengguna meminta akar resume dan pesan sukses palsu diperbaiki. Patch kini aktif dan tes lulus: 25 frontend, 18 backend, build serta browser UI/audio sintetis. Dokumentasi terpisah: reload-resume-fix.md dan E09. Status live setelah patch belum diketahui; hasil M03 sebelumnya tidak diganti menjadi lulus. F01 masuk scope tambahan terbatas pada layar kandidat, bukan seluruh lifecycle assessor.
