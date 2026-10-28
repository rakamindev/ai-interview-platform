# Panduan presentasi: perbaikan audio wawancara

Dokumen pendamping untuk memahami perubahan, bukan naskah yang harus dihafalkan. Gunakan bersama `audio-fix.md` dan bukti pada `evidence/`. Status saat ditulis: implementasi serta tes terkontrol selesai; percakapan Gemini live setelah patch belum diverifikasi.

## 1. Apakah boleh mengubah kode?

Ya. Brief meminta implementasi perubahan pada backend dan frontend beserta automated tests. Bagian Step 5 menyebut API, model data di bawahnya, layar frontend, dan pengujian; baseline juga meminta pembuktian regresi, penanganan kegagalan, serta keamanan data. Artinya, menambahkan catatan temuan saja belum memenuhi pekerjaan implementasi.

Untuk perubahan audio ini, kode frontend dan backend diperbaiki, tetapi tidak ada migrasi atau perubahan struktur database karena bug yang ditangani berada pada lifecycle audio dan event protokol. Jika reviewer meminta kedalaman pada model data, jelaskan keputusan tersebut dan bukti yang melandasinya; jangan mengarang migrasi demi jumlah file.

Brief memperbolehkan AI. Pengguna tetap perlu memeriksa hasil, memahami perubahan, dan mampu menjelaskannya pada technical defense. Tidak perlu mengklaim bahwa semua kode dibuat tanpa bantuan AI.

## 2. Cerita masalah dalam 30 detik

> Saat mencoba alur kandidat, AI kadang diam dan jawaban kandidat tidak muncul dalam transcript. Saya tidak langsung menyimpulkan koneksi internet buruk. Saya menelusuri empat batas: mikrofon browser, WebSocket, event Gemini, dan playback. Saya menemukan beberapa jalur kode yang dapat menahan suara atau pergantian giliran, lalu mereproduksinya melalui regression tests sebelum memperbaikinya.

Dampak bisnis yang bisa dijelaskan: kandidat tidak dapat menyampaikan bukti kemampuannya, waktu wawancara terbuang, dan assessor dapat memperoleh hasil yang tidak lengkap. Belum ada pengukuran peningkatan konversi, penghematan biaya, atau akurasi penilaian setelah patch.

## 3. Pahami alur audio dahulu

```text
Kandidat berbicara
  -> mikrofon browser
  -> AudioWorklet mengubah sample menjadi PCM16 16 kHz
  -> WebSocket browser ke API
  -> API meneruskan audio ke Gemini
  -> Gemini mengirim audio 24 kHz, transcript, dan event giliran
  -> API meneruskan audio/event ke browser
  -> browser menjadwalkan suara AI di speaker
  -> setelah suara selesai, input kandidat dibuka kembali
```

Istilah yang perlu dikuasai:

| Istilah | Arti dalam perubahan ini |
| --- | --- |
| Capture | Mengambil suara mikrofon dan menyiapkan data untuk dikirim |
| Playback | Memainkan data suara AI melalui speaker/headset |
| AudioContext | Mesin pemrosesan audio milik browser; dapat running atau suspended |
| AudioWorklet | Pemroses audio yang berjalan terpisah dari pekerjaan UI utama |
| PCM16 | Sample suara mentah sebagai angka 16-bit; bukan file MP3 |
| Sample rate | Banyaknya sample per detik; jalur existing memakai input 16 kHz dan output 24 kHz |
| Gate/mute | Menghentikan pengiriman frame mikrofon sementara, bukan mematikan perangkat setiap giliran |
| Buffer/queue | Data yang menunggu disimpan atau diputar |
| Flush transcript | Mengirim teks yang sudah terkumpul ke callback penyimpanan, bukan menghapus database |
| Race condition | Hasil bergantung pada urutan dua pekerjaan asynchronous yang bisa berbeda kecepatannya |

Log `Audio forwarded` hanya membuktikan byte diteruskan. Log itu tidak menjamin byte berisi suara yang terdengar, model memahaminya, atau speaker browser sudah berjalan.

## 4. Perubahan per file

### A. InterviewPage.tsx: urutan startup dan giliran

File: `web/src/pages/interview/InterviewPage.tsx`, khususnya `startInterview`, `handleStateChange`, dan pesan error perangkat.

Urutan lama secara ringkas:

```text
connect WebSocket -> tunggu setup mikrofon -> mute
```

Contoh race yang ingin dicegah: server cepat mengirim giliran kandidat, kemudian setup mikrofon yang lebih lambat selesai dan memanggil mute lagi. Kandidat dapat melihat sesi aktif tetapi inputnya tertutup. Status active juga sebelumnya bisa membuka input walaupun speaker masih AI.

Urutan baru:

```text
mute -> mulai prepare playback dan capture dari klik Start
     -> tunggu keduanya siap -> connect WebSocket
     -> buka input hanya sesuai giliran kandidat dan selesainya playback
```

`Promise.all` memulai dua persiapan audio dalam handler klik yang sama, kemudian menunggu hasilnya. Bila perangkat tidak siap, koneksi sesi belum dibuka dan pengguna mendapat pesan untuk memeriksa izin/perangkat lalu mencoba lagi.

Kalimat presentasi: "Saya membuat kesiapan perangkat menjadi syarat sebelum sesi dibuka, dan memisahkan status koneksi dari giliran berbicara. Connected bukan berarti mikrofon boleh mengirim saat itu juga."

### B. useAudioCapture.ts: input yang aktif dan resource yang dibersihkan

File: `web/src/hooks/useAudioCapture.ts`.

- AudioContext dibuat dan mulai di-resume sebelum menunggu izin mikrofon agar aktivasi audio dimulai dari interaksi pengguna.
- Worklet dihubungkan ke destination supaya graph memiliki jalur render aktif. Processor existing hanya mengirim PCM melalui message port dan tidak mengisi output speaker, sehingga perubahan ini tidak dimaksudkan untuk memutar ulang suara mikrofon ke telinga kandidat.
- `start` mengembalikan boolean untuk membedakan perangkat berhasil dimulai dari kegagalan setup.
- `stop` menutup context, menghentikan track, dan melepas worklet. Cleanup juga berjalan ketika halaman unmount.
- Penanda versi startup mencegah hasil izin perangkat yang datang terlambat mengaktifkan capture yang sudah dibatalkan.

Kalimat presentasi: "Mendapat izin mikrofon saja belum cukup. Context audio dan graph harus aktif, lalu perangkat harus dilepas saat setup gagal atau kandidat meninggalkan halaman."

### C. useAudioPlayback.ts: membuka audio pada klik Start

File: `web/src/hooks/useAudioPlayback.ts`.

Sebelumnya context playback baru dibuat ketika chunk suara pertama tiba melalui WebSocket. Browser dapat membatasi audio yang dimulai di luar interaksi pengguna. Method baru `prepare()` membuat atau melanjutkan context dari klik Start sebelum suara AI datang.

Konversi PCM16 ke Float32 dan penjadwalan output 24 kHz tetap menggunakan alur existing. Callback untuk membuka input setelah antrean selesai sekarang dicatat dan dibatalkan saat playback dihentikan. Jadi callback lama tidak membuka mikrofon pada sesi yang sudah berhenti.

Kalimat presentasi: "Saya menyiapkan izin menjalankan speaker saat pengguna menekan Start, lalu tetap menjadwalkan chunk secara berurutan agar suara tidak saling menimpa."

### D. live_client.rb: memahami akhir giliran model

File: `api/app/clients/gemini/live_client.rb`, khususnya `handle_generation_complete`, `handle_turn_complete`, dan `open_turn_gate`.

Menurut referensi Google, `serverContent.turnComplete` menyatakan model selesai bergiliran. Kode lama mempunyai cabang yang menyebutnya akhir giliran user dan hanya mem-flush input. Dua kegagalan terkontrol ditemukan:

1. Model menyelesaikan respons tanpa audio, tetapi callback membuka giliran kandidat tidak dipanggil.
2. Audio model berakhir tanpa generationComplete, tetapi buffer transcript kandidat belum dikirim untuk penyimpanan.

Sekarang akhir giliran mem-flush buffer kandidat dan AI, menghentikan silence pump, dan mengembalikan giliran kandidat. Flag `@turn_gate_open` mencegah callback ganda ketika generationComplete dan turnComplete datang dalam satu rangkaian. Jika delay drain sudah dijadwalkan, delay itu dipertahankan.

Kalimat presentasi: "Saya memperbaiki interpretasi event, bukan memaksa unmute setelah sekian detik. Event protokol bisa datang dalam beberapa kombinasi, dan masing-masing harus memberi hasil state yang konsisten."

## 5. Mengapa memilih pendekatan ini?

| Pilihan | Kelebihan | Kekurangan | Keputusan |
| --- | --- | --- | --- |
| Hanya memperbaiki startup browser | Perubahan kecil; mengurangi risiko autoplay dan race perangkat | Gate backend dan kehilangan flush transcript pada event tertentu tetap ada | Tidak cukup untuk jalur yang direproduksi |
| Perbaiki lifecycle browser dan interpretasi event backend | Menangani jalur bermasalah pada kedua sisi; arsitektur existing tetap dapat dipakai | Memerlukan regression test lintas batas dan live smoke test | Pendekatan yang diimplementasikan |
| Ganti seluruh transport/SDK audio | Bisa membuka rancangan yang lebih luas | Perubahan besar, risiko migrasi, dan sulit dibuktikan menjelang deadline | Ditunda karena belum diperlukan oleh bukti saat ini |

Trade-off penting: menunggu perangkat sebelum connect dapat membuat Start menunggu izin pengguna lebih lama, tetapi tidak membuka sesi diam ketika perangkat belum siap. Gate mikrofon menekan echo, namun kemampuan interupsi/barge-in penuh belum menjadi target perubahan ini.

## 6. Cara membuktikan, bukan sekadar mengatakan sudah diperbaiki

| Lapisan | Yang dibuktikan | Bukti saat ini |
| --- | --- | --- |
| Regression frontend | Urutan startup, suspended capture, gate mute, kegagalan perangkat, cleanup, playback | Baseline 8 gagal/1 lulus; setelah patch 9 lulus |
| Regression backend | Turn tanpa audio, input flush tanpa generationComplete, callback satu kali | Baseline 2 gagal/1 lulus; setelah patch 3 lulus |
| Browser nyata | Tone sintetis menghasilkan PCM non-hening; mute/unmute dan render/drain berjalan pada Web Audio Edge | Smoke test lulus |
| Build | TypeScript dan bundling tidak rusak | Keduanya exit 0 |
| Runtime lokal | Container memakai source yang dimaksud dan API hidup setelah restart | Hash source cocok; health ok |
| Percakapan live | Mikrofon pengguna, Gemini, dan speaker bekerja end-to-end setelah patch | Masih perlu diverifikasi |

Perintah untuk demonstrasi pengujian:

```powershell
cd D:\ai-interview-platform\web
npm.cmd test
npm.cmd run test:audio-browser
docker run --rm --network none ai-interview-api:local bundle exec rspec --format documentation
```

Gunakan output tersimpan di `assessment/evidence/` untuk menunjukkan red-green. Test harness memakai perangkat/model sintetis agar kegagalan bisa diulang tanpa kuota Gemini atau data kandidat. Jangan menyebut seluruhnya integrasi live.

## 7. Alur demo singkat

1. Tunjukkan masalah dan dampaknya kepada kandidat, menggunakan screenshot/log yang sudah disanitasi.
2. Jelaskan urutan startup lama dan baru; buka empat file utama hanya pada bagian yang relevan.
3. Tunjukkan satu assertion gagal pada baseline serta hasil green. Jangan menjalankan versi rusak pada sesi kandidat aktif.
4. Jalankan smoke test browser untuk menunjukkan input/output audio diproses tanpa layanan eksternal.
5. Bila live verification sudah dilakukan, tunjukkan sesi baru dengan minimal tiga pertukaran dan transcript kandidat. Jika belum, nyatakan batasnya.
6. Tutup dengan risiko yang tersisa dan alasan scope dipilih.

## 8. Pertanyaan technical defense yang mungkin muncul

**Kenapa bukan jaringan?**

Belum ada bukti bahwa jaringan adalah satu-satunya penyebab. Penggantian endpoint speed test mengubah jalur pengukuran. Karena ada masalah lifecycle yang dapat direproduksi tanpa jaringan, saya memperbaiki masalah kode yang sudah terbukti dahulu.

**Kenapa tidak cukup melihat log chunk audio?**

Chunk hanya byte. Saya juga menguji sample non-hening, state context, giliran mikrofon, dan render playback.

**Apakah mock tidak membuat tes terlalu mudah lulus?**

Tes frontend menjalankan hook dan halaman production; perangkat browser dan transport diganti pada batas eksternal. Spec backend menjalankan parser production dengan pesan protokol sintetis. Browser smoke menambah pembuktian menggunakan Web Audio asli. Tetap diperlukan live test karena mock tidak membuktikan kualitas jaringan, model, atau perangkat pengguna.

**Apakah perbaikan menyelesaikan semua audio?**

Belum dapat diklaim. Jalur kode yang direproduksi sudah diperbaiki dan lulus tes. Stabilitas sesi panjang, reconnect live, speaker fisik, dan perilaku model masih perlu bukti terpisah.

**Apa bedanya data transcript dan rekaman audio?**

Perubahan ini menangani buffer teks dan stream audio. Jangan menyatakan file rekaman audio tersimpan hanya karena transcript tersedia; penyimpanan rekaman audio penuh tidak dibuktikan pada pekerjaan ini.

**Apakah ada perubahan database atau kehilangan data?**

Tidak ada migrasi, penghapusan, atau perubahan database yang dijalankan oleh patch. Cleanup menutup resource browser. Konsistensi portfolio dan seluruh jalur penulisan transcript tetap perlu diuji pada alur live.

**Apakah sudah memenuhi seluruh submission?**

Belum siap submission. Seeded fault kini selesai dengan tiga commit lokal dan bukti tes, sedangkan publikasi history, finalisasi scope/acceptance criteria, pengujian live lanjutan, PR, PDF, dan video masih perlu dilengkapi. Raw red-green sebelumnya dibedakan dari eksperimen seeded fault E06.

**Apa contoh hasil AI yang salah lalu diverifikasi?**

Saat membuat tes, AI menulis fake timer Ruby yang menghasilkan NameError. Itu diperbaiki sebagai error harness dahulu, baru assertion baseline dipakai sebagai bukti bug. Detailnya ada pada bagian AI verification moment di `audio-fix.md`. Akui bantuan AI dan jelaskan bagaimana hasilnya diperiksa.

## Referensi

- Brief Fullstack Product Engineer pengguna: Step 5, minimum baseline, dan live technical defense.
- [PRD 01: perilaku pewawancara dan bukti penilaian](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-01-%E2%80%94-First-Principles:-AI-Interview-Behavior)
- [Google Live API: serverContent dan turnComplete](https://ai.google.dev/api/live#BidiGenerateContentServerContent)
- [MDN: aktivasi AudioContext melalui interaksi pengguna](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

## 9. Penjelasan patch lanjutan setelah uji live

Versi awal berhasil pada satu pertukaran live, tetapi pengguna masih mengalami AI diam setelah jawaban berikutnya. Jangan menutupi hasil ini dalam presentasi: temuan live mengarahkan tes tambahan.

- Indikator lama hanya membaca giliran. Sekarang energi input diukur untuk menampilkan Sound detected atau Your turn. Karena ini meter energi, suara latar juga dapat terdeteksi.
- Saat browser tidak lagi mengirim frame, backend mengirim audioStreamEnd setelah jeda yang diperiksa dari frame terakhir. Ini memberi tanda eksplisit bahwa stream input berhenti; model tetap memakai automatic VAD dan stream dapat dilanjutkan oleh audio baru.
- Watchdog sebelumnya dapat memasukkan durasi jawaban kandidat ke hitungan waktu tunggu respons. Tes jawaban 35 detik membuktikan koneksi ditutup terlalu dini. Timeout kini dimulai dari akhir input, sehingga kandidat tidak dihukum karena memberi jawaban panjang.
- Pemanggil proactive reconnect diperbarui untuk memakai state waiting_for_response; ini perubahan tambahan pada middleware audio backend.

Angka pengujian terkini: 12 tes frontend dan 6 spec backend lulus; browser smoke sintetis serta build lulus. Uji live setelah patch lanjutan tetap diperlukan. Bukti red-green tambahan ada pada audio-indicator-*.txt dan audio-pause-*.txt di folder evidence.

Kalimat presentasi: "Saya membedakan status giliran, deteksi energi mikrofon, dan waktu tunggu model. Ketiganya punya arti berbeda. Setelah uji live menemukan percakapan masih macet, saya menambah reproduksi untuk akhir input dan timeout, lalu memperbaikinya dengan mekanisme protokol yang didokumentasikan."
## Penjelasan tambahan untuk presentasi
Tes sebelumnya menguji hook dan playback, namun tidak menguji processor asli dengan suara pelan. Saya menambahkan tes pada batas itu dan menemukan filter lokal menghapus sebagian input. Solusinya mempertahankan PCM beserta jedanya dan menyerahkan deteksi akhir bicara kepada VAD Gemini. Pada resume browser, sinyal giliran kandidat juga harus dikirim supaya mikrofon yang awalnya mute dibuka. Keduanya punya bukti fail-before-fix; kestabilan percakapan nyata masih perlu diuji, sehingga saya tidak mengklaim audio sudah 100 persen stabil.

## Seeded fault untuk presentasi
Eksperimen terpisah selesai pada branch lokal loma/seeded-fault-resume: baseline 5fa769d (8 lulus), fault c533d0d (1 gagal dari 8), revert 722cec0 (8 lulus). Satu pesan giliran kandidat dihilangkan dan dikembalikan; assertion identik. Panduan lengkap, perintah pemeriksaan, dan kalimat presentasi ada di seeded-fault.md. History belum dipush dan harus ditautkan sebelum submission.

## Menjelaskan perbaikan reload/resume
Lihat reload-resume-fix.md untuk before/after, file, trade-off, dan skrip presentasi. Poin inti: browser disconnect bukan end interview; handle expired tidak diulang terus; fallback hanya memakai turn tersimpan; Complete memerlukan hasil normal yang diketahui, dan manual end menunggu ack. Hasil otomatis 25 frontend/18 backend lulus. Uji live ulang perlu sesi baru; record lama ended/error tidak dibuka ulang. Cleanup abandoned-session serta multi-tab masih batas implementasi.
