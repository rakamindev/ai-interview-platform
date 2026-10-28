# Pemeriksaan dan perbaikan tampilan mobile

Tanggal: 28 Oktober 2026. E13. Commit terpisah dari perbaikan Retry E12.

## Yang diperiksa

UI production build dijalankan pada server preview terisolasi, lalu dibuka di Edge Chromium dengan viewport **360, 390, 768, dan 1280 px**. Empat layar per lebar: precheck, interview aktif, portfolio, dan fit/gap. Dataset sengaja memuat nama panjang, label skill tanpa spasi, evidence panjang, serta transkrip identifier panjang. Semua API, speed-test response, WebSocket, dan input audio bersifat sintetis.

Tidak memakai env/credential, API/database project, Gemini, mikrofon, atau kamera pengguna. Browser memakai autoplay override untuk menilai layout; ini bukan pembuktian autoplay/izin pada browser fresh atau ponsel fisik.

## Temuan yang direproduksi sebelum perubahan

**8 dari 16 skenario gagal**; tidak ada request fixture yang tidak tertangani maupun page error pada run pembuktian. Contoh lebar dokumen dibanding viewport:

| Layar | Viewport | Dokumen sebelum | Dampak |
| --- | --- | --- | --- |
| Interview | 360 | 576 | Mic dan End Interview berada di luar viewport |
| Portfolio | 360 | 1055 | Header, tombol, label skill, dan identifier evidence melebar |
| Fit/gap | 390 | 527 | Header/JSON melewati viewport |
| Portfolio dengan teks panjang | 1280 | 1343 | Label/evidence tanpa spasi masih membuat overflow pada desktop |

Precheck muat pada keempat viewport. Tidak mengubah layout precheck yang sudah muat. Pada browser fixture, mic denial -> Retry -> mic diizinkan menghasilkan Start aktif tanpa reload; ini tambahan verifikasi E12 pada built UI, bukan izin perangkat nyata.

## Perbaikan yang dipilih

- Header assessor dapat berbaris pada layar sempit; nav, tenant, dan Logout tetap tersedia.
- Header hasil dan aksi ekspor dapat turun baris. Pilihan vacancy dan tombol fit/gap disusun vertikal pada layar sempit.
- Container interview mengikuti lebar viewport. Bubble transkrip, nama, skill, dan evidence panjang boleh membungkus teks tanpa mengubah datanya.
- Tombol kontrol interview dapat wrap dan memiliki tinggi minimum 44 px di viewport kecil.
- Tabel fit/gap tetap berupa tabel dengan region scroll tersendiri yang berlabel dan focusable. Scroll tabel tidak memperlebar seluruh halaman; ringkasan dapat wrap.

Tidak menyembunyikan overflow global dengan clipping. Tidak mengganti font/palette/layout produk secara menyeluruh. Kontrak expected_level/required_level F10 tidak diubah; fixture sengaja memakai expected_level sesuai API sehingga perbaikan CSS tidak dianggap memperbaiki nilainya.

## Hasil sesudah

**16/16 skenario lulus**: lebar dokumen sama dengan viewport, kontrol yang ditargetkan berada dalam lebar layar, serta kolom Result dapat ditampilkan setelah scroll region tabel. Pengujian juga benar-benar menekan Retry, Start, mute, End beserta dialog konfirmasi, dan mengunduh JSON sintetis. Pada fixture yang sama, tidak ada unknown request atau page error. Suite frontend tetap **31 lulus**; typecheck/build exit 0.

Tes scroll tabel mengatur scrollLeft lewat script. Itu membuktikan kolom dapat berada dalam area viewport, bukan bukti gesture touch/keyboard pada perangkat nyata. Tombol End diuji dengan acknowledgement WS sintetis, bukan kondisi provider nyata.

## Evidence dan cara menjalankan

- [Before: hasil dan screenshot](evidence/mobile-before/results.json) - [log assertion gagal](evidence/mobile-before.txt).
- [After: hasil dan screenshot](evidence/mobile-after/results.json) - [log lulus](evidence/mobile-after.txt).
- [31 tes frontend](evidence/mobile-unit-green.txt) - [typecheck/build](evidence/mobile-build.txt).
- Screenshot contoh: [interview 360](evidence/mobile-after/interview-360.png), [portfolio 360](evidence/mobile-after/portfolio-360.png), [fit/gap 390](evidence/mobile-after/fitgap-390.png), [mic ditolak 390](evidence/mobile-after/microphone-failed-390.png).

Dari web/: build dengan `envDir: false` seperti panduan evidence, kemudian `node scripts/mobile-smoke.mjs`. Script menulis ke evidence/mobile-after dan berhenti dengan exit 1 jika overflow, kontrol di luar layar, request fixture yang tidak dikenal, atau browser error ditemukan. `--before` memilih direktori output sebelum, bukan mengembalikan source lama.

Run awal harness sempat salah menangkap navigasi portfolio sebagai API dan menganggap CardTitle sebagai heading. Harness diperbaiki sebelum run pembuktian; timeout fixture itu tidak dihitung sebagai bug produk atau hasil before. Log before yang diarsipkan berasal dari fixture valid dan gagal pada assertion layout.

## Cara memahami dan uji ulang sendiri

1. Buka DevTools mode responsive, pilih 360 atau 390 px.
2. Pada interview, pastikan Mic/End terlihat tanpa menggeser seluruh halaman ke samping.
3. Pada portfolio, nama panjang, label skill, dan evidence harus membungkus; aksi ekspor tetap dapat dijangkau.
4. Pada fit/gap, geser region tabel ke samping untuk melihat Candidate dan Result. Halaman luarnya tetap selebar layar.
5. Bedakan layout tabel dari F10: kolom Required yang kosong pada data existing masih merupakan temuan kontrak API/UI yang belum diperbaiki.

Untuk presentasi: "Saya menguji empat layar pada empat viewport dengan teks panjang. Sebelum perubahan, delapan skenario overflow. Setelah pembungkusan dan region scroll diperbaiki, enam belas skenario lulus. Ini emulasi viewport Edge dengan fixture, belum sertifikasi seluruh ponsel atau browser mobile."

## Batas

Belum menguji Safari/iOS, Android fisik, rotasi/keyboard virtual, gesture touch, viewport landscape pendek, setiap halaman formulir/vacancy/monitor, semua panel override, ekspor PDF di ponsel, atau kualitas suara/latensi internet. Live recovery dan endurance tetap bukan klaim perbaikan ini.
