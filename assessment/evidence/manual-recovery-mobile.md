# Catatan uji manual error/recovery dan mobile

Tanggal: 27 Oktober 2026. Sumber: tindakan dan hasil yang dikonfirmasi pengguna dalam percakapan. Session ID percobaan recovery tidak dikonfirmasi; jangan otomatis mengaitkannya dengan sesi 18. Tidak ada token, identitas, atau kutipan jawaban yang disalin.

## M01 - Penolakan dan pemulihan izin mikrofon

1. Pengguna memblokir izin mikrofon pada situs.
2. Setelah menekan Retry, OS & browser tertahan Checking. Pengguna mengonfirmasi gejala hanya muncul setelah Retry, bukan pada reload awal.
3. Halaman di-reload dengan izin tetap Block: Microphone menjadi Failed dan tombol Start Interview nonaktif.
4. Izin diubah menjadi Allow, lalu halaman di-reload: Microphone menjadi Passed dan tombol Start aktif kembali.

**Hasil:** PASS terbatas untuk mendeteksi penolakan izin serta pemulihan lewat Allow + reload. FAIL untuk recovery melalui tombol Retry, konsisten dengan F02. Label Failed tidak membuktikan ada copy penjelasan penyebab/solusi yang rinci. Pesan startup error di InterviewPage adalah jalur terpisah dari precheck ini.

**Bukti source F02:** effect OS/browser hanya berjalan saat mount. retryAll mengubah state menjadi LOADING tetapi tidak memicu effect mount lagi. Tidak ada perubahan source untuk memperbaikinya pada rangkaian uji ini.

## M02a - Percobaan pemutusan jaringan: belum konklusif

Pengguna memilih Offline pada DevTools; indikator tetap Connected. Pengguna juga mematikan Wi-Fi 10 detik; indikator tetap Connected dan tidak terlihat Reconnecting.

**Hasil:** INCONCLUSIVE untuk pemulihan gangguan jaringan nyata. Jalur browser ke localhost API tetap lokal ketika Wi-Fi mati. Label Connected tidak membuktikan backend ke Gemini masih sehat. Tidak ada korelasi log yang membuktikan koneksi Gemini benar-benar terputus atau pulih akibat dua tindakan tersebut. Jangan menyatakan tes offline sukses atau seluruh recovery gagal hanya dari label ini.

## M02b - Simulasi reconnect Gemini melalui tombol development

**Langkah:** Wi-Fi aktif, interview sedang berlangsung, lalu tekan Force reconnect sekali. Source debug memicu jalur reconnect Gemini di backend; tindakan ini berbeda dari reload browser atau gangguan jaringan alami.

**Aktual yang dikonfirmasi pengguna:** indikator berubah Reconnecting -> Connected, lalu AI kembali merespons jawaban.

**Hasil:** PASS terbatas untuk satu simulasi reconnect Gemini dan kelanjutan respons AI. Tidak ada konfirmasi terpisah bahwa transkrip jawaban pascareconnect tampil/tersimpan, sehingga hal itu belum diklaim. Screenshot/video recovery dan session/timestamp terkorlasi belum dikemas.

**Batas:** bukan bukti ketahanan jaringan nyata, browser-API disconnect, replay audio tanpa kehilangan, zero duplicates, semua race timing, atau endurance 45 menit. Jangan menggabungkan hasil M02b dengan AC09 yang menguji browser resume; keduanya jalur berbeda.

## M03 lanjutan - Sesi 23 dapat dilanjutkan setelah patch

Pengguna mengidentifikasi sesi 23 melalui halaman assessor dan akhirnya mengonfirmasi bahwa sesi yang sama dapat dilanjutkan. Ini merupakan hasil positif live setelah patch E09, bukan hanya status Connected atau tampilan transkrip lama.

**Status:** PASS terbatas untuk kemampuan melanjutkan sesi 23 pada percobaan lanjutan. Sebelumnya pengguna melaporkan macet pada giliran kandidat, mencoba reconnect, dan melakukan percobaan mute; metadata saat investigasi juga menunjukkan sesi 23 masih active. Urutan pemulihan terakhir tidak direkam secara terisolasi. Karena itu jangan menyatakan semua reload pulih otomatis, menganggap mute/reconnect tertentu terbukti sebagai satu-satunya penyebab pemulihan, atau menghapus laporan kegagalan awal.

Belum dikonfirmasi terpisah: transkrip baru tersimpan di database setelah pemulihan, sisa waktu tidak reset, keakuratan konteks AI, serta keberhasilan berulang dari prosedur reload tanpa intervensi. Video/screenshot dengan korelasi waktu belum dikemas. Hasil live ini mendukung bahwa melanjutkan sesi dapat bekerja, tetapi masih memiliki gejala intermiten yang perlu dijelaskan.

## Tes yang masih terbuka

### M03 - Reload/resume: gagal pada percobaan ini

Pengguna me-reload halaman tanpa menekan End Interview; halaman langsung menyatakan Interview Complete. Hasil manual: FAIL untuk melanjutkan sesi pada percobaan ini.

Metadata backend terbaru menunjukkan sesi 20 berstatus ended, end_reason error, mulai 14:02:41 UTC dan berakhir 14:07:42 UTC pada 27 Oktober 2026. Log metadata menunjukkan browser disconnect code 1001, kegagalan Gemini 1011/1008, retry habis, dan EndHandler reason error. Session ID 20 adalah korelasi sesi terbaru dari log/database; pengguna belum mengonfirmasi ID lewat URL terpisah. Tidak ada token atau isi jawaban yang disalin.

Log menunjukkan gangguan Gemini sudah terjadi sebelum browser disconnect; jadi belum dibuktikan bahwa reload sendirian menjadi penyebab akhir sesi atau penolakan Gemini. Reason lengkap code 1008 belum dianalisis. Jangan menyebut reload pasti merusak token, replay, atau grace period hanya berdasarkan percobaan ini.

Pemetaan UI pada InterviewPage mengubah session_status ended menjadi complete dan juga memetakan kegagalan load candidate info menjadi complete. Status runtime yang ended karena error bukan bukti kandidat selesai normal. Ini memperkuat F01 dan membatasi klaim F07. Spec serta seeded fault AC09 hanya membuktikan sinyal kandidat pada callback resume; tidak membuktikan keseluruhan lifecycle reconnect/grace period/model acceptance aman.

Lulus M02b tetap dibatasi pada simulasi sebelumnya yang sempat kembali merespons; itu tidak dibatalkan atau digeneralisasi menjadi semua jalur recovery lulus. Tidak ada perubahan kode pada tahap pencatatan ini.
- M04: viewport 390 px dan 320 px pada interview/portfolio/fit-gap; belum dijalankan. Emulasi viewport tidak membuktikan audio pada ponsel nyata.
- Gangguan jaringan nyata dengan korelasi status kedua jalur WebSocket, transkrip pascarecovery, dan pengulangan sesi masih perlu bukti.

Tidak ada perubahan kode atau pengoperasian mikrofon/key oleh asisten dalam rangkaian pencatatan ini. Semua hasil live di atas dilaporkan pengguna. F02 tetap terbuka; pengujian error/recovery keseluruhan belum dinyatakan selesai.

Update E09: source reload/resume dan outcome sudah diperbaiki setelah M03 gagal, dengan 25 tes frontend dan 18 backend lulus serta UI browser sintetis. Referensi reload-resume-fix.md. Keberhasilan M03 ulang setelah patch masih pending; jangan menyamakan hasil sebelum/sesudah tanpa uji pengguna berikutnya.
