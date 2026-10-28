# Perbaikan Retry hardware check

Tanggal: 28 Oktober 2026. Scope tambahan yang diminta pengguna; commit terpisah dari pekerjaan mobile.

## Masalah dan penyebab

Pada baseline, Retry hanya mengatur checklist kembali ke OS/browser Checking. Effect OS memakai dependency kosong sehingga berjalan sekali saat mount, lalu tidak dijalankan oleh reset state. Tes internet tidak dimulai kembali dan kandidat tertahan. Ini F02 yang sebelumnya dilaporkan pengguna, bukan penggantian threshold agar tes selalu lolos.

Selain itu, stream mikrofon tanpa kamera tidak disimpan untuk cleanup; monitor AudioContext/animation frame juga dapat tertinggal. Hasil izin yang datang setelah unmount masih diproses. Retry yang benar perlu memisahkan resource tiap percobaan.

## Perubahan

- Props publik `onStart` dan urutan checklist tetap sama.
- Komponen luar memegang nomor percobaan. Retry mengganti key komponen checklist internal sehingga state dan effect dimulai ulang satu kali untuk percobaan baru.
- Timer OS dibatalkan pada unmount; hasil promise dari percobaan lama diabaikan.
- Stream, AudioContext monitoring/output, dan animation frame milik percobaan dilepas. Stream izin terlambat langsung dihentikan.
- Start kembali nonaktif selama pemeriksaan ulang dan hanya aktif jika semua langkah lulus. Error tetap Failed; tidak ada bypass.

Tidak mengubah threshold 8 Mbps download/4 Mbps upload/300 ms ping, kontrak backend, atau model AI. Kemampuan menjadwalkan beep belum membuktikan pengguna benar-benar mendengarnya.

## Bukti otomatis E12

`web/src/components/HardwareCheck.test.tsx` menambah lima regression tests dengan speed/device sintetis:

1. Internet gagal -> Retry mengulang OS/internet -> pemeriksaan baru lulus -> Start aktif dan callback dapat dipakai.
2. Mikrofon ditolak -> Retry setelah izin tersedia -> Start aktif tanpa reload.
3. Hasil izin yang kembali sesudah unmount langsung melepas track.
4. Unmount menghentikan stream/context/frame.
5. Audio output gagal -> Retry membersihkan resource lama dan memulai pemeriksaan baru.

Sebelum perbaikan: **5 gagal** pada assertion pengulangan/cleanup. Sesudah: **5 lulus**. Suite frontend keseluruhan: **31 lulus**. Typecheck dan build tanpa env lokal diperiksa pada evidence. Log:

- [Red](evidence/hardware-retry-red.txt)
- [Green terarah](evidence/hardware-retry-green.txt)
- [Suite lengkap](evidence/hardware-full-green.txt)
- [Typecheck/build](evidence/hardware-build.txt)

Ini belum mengonfirmasi semua perangkat/izin browser nyata. Uji browser dengan fixture dan viewport dicatat terpisah pada pekerjaan mobile; tidak memakai Gemini atau mic/kamera pengguna. F05 (validitas metode speed test) tidak ditutup oleh perbaikan Retry.

## Cara uji ulang sendiri

1. Buka undangan sesi yang belum berakhir dan blokir izin mic.
2. Setelah OS/internet lulus, pastikan Microphone Failed dan Start nonaktif.
3. Izinkan mic lewat pengaturan situs, lalu klik Retry tanpa reload.
4. OS/browser kembali Checking sebentar, kemudian internet dan perangkat diperiksa ulang. Jika semua lulus, Start aktif.
5. Jika internet gagal sungguhan, Retry tetap boleh gagal di Internet. Jangan menganggapnya bug hanya karena pemeriksaan tidak lolos.

Untuk presentasi: "Sebelumnya tombol mereset tampilan tetapi tidak menjalankan effect OS lagi. Sekarang Retry membuat percobaan baru dengan lifecycle sendiri, dan resource percobaan lama dibersihkan. Saya membuktikan jalur gagal-ke-lulus lewat tes sebelum dan sesudah, tanpa mengubah batas kelulusan."

Update browser E13: pada keempat viewport, built UI melewati Microphone Failed -> Retry -> Passed/Start aktif tanpa reload dengan media sintetis. Pengujian perangkat nyata tetap belum diklaim.
