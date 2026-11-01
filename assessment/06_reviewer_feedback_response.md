# Tanggapan atas Feedback Reviewer

Branch perbaikan: `fix/reviewer-feedback`

| # | Feedback | Status |
|---|---|---|
| 1 | Microphone failure (F6) bisa mengakhiri sesi | Selesai, sudah dicoba manual |
| 2 | Rename key F3 belum aman untuk data lama | Menyusul |
| 3 | State Portfolio F4 belum lengkap | Menyusul |
| 4 | Failure conditions pada perbandingan opsi | Menyusul |
| 5 | AI Verification Moment | Menyusul |

---

## 1. Microphone Failure (F6)

**Commit:** `b1d6d3f`

### Feedback

WebSocket dibuka sebelum akses microphone berhasil diperoleh. Akibatnya, ketika akses microphone gagal, sesi sudah berstatus `active` dan akhirnya dihentikan. Urutannya perlu diubah agar microphone diperoleh lebih dulu.

### Akar masalah

`startInterview` memanggil `connect()` sebelum `startCapture()`. Backend menjalankan `Sessions::StartHandler` begitu socket tersambung, sehingga sesi menjadi `active` meskipun microphone belum tentu tersedia.

Saat mereproduksi, saya menemukan dampak yang lebih parah dari perkiraan saya sebelumnya. Perbaikan F6 yang pertama memang menyetel layar ke pesan error microphone, tetapi penutupan socket lalu menjalankan `onclose`, yang mengganti layar menjadi "Interview Complete". Kandidat melihat interview seolah selesai, padahal belum dimulai dan sesinya sudah berakhir.

Kesalahan ini lolos karena tes F6 saya memakai mock untuk `useAudioWebSocket`, sehingga `onclose` yang asli tidak pernah berjalan.

### Perbaikan

- Urutan `startInterview` menjadi: dapatkan microphone, mute, baru `connect()`.
- `useAudioCapture.start()` mengembalikan `true` atau `false`. Jika `false`, socket tidak dibuka sama sekali.
- Jika setup gagal setelah microphone sempat didapat, microphone dilepas agar tidak tetap menyala.

### Cara reproduce

Saya membandingkan dua project yang berjalan berdampingan: clone versi yang direview (`a250a03`) dan versi perbaikan.

1. Buka link undangan kandidat, izinkan microphone, dan tunggu semua hardware check lolos.
2. Buka DevTools → Network → filter WS.
3. Tempel baris berikut di Console untuk mensimulasikan microphone yang gagal setelah hardware check lolos:

   ```js
   navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'))
   ```

4. Klik **Start Interview**, lalu periksa layar, tab WS, dan status sesi di database.

### Hasil

| Yang diperiksa | Sebelum | Sesudah |
|---|---|---|
| Layar | "Interview Complete" | "Couldn't access your microphone" dengan tombol "Try again" |
| Koneksi WebSocket | Dibuka | Tidak dibuka |
| Status sesi | `ended` | Tetap `pending` |
| `started_at` | Terisi | `nil` |
| `end_reason` | `error` | `nil` |

Hasil di atas sesuai ekspektasi. Di clone, sesi berakhir sekitar 8 detik setelah dimulai karena clone tidak memakai API key asli, sehingga koneksi ke Gemini gagal lebih dulu. Dengan API key yang valid, kode backend menunjukkan sesi akan dihentikan oleh grace timer 120 detik. Jalur grace timer ini saya telusuri dari kode, tidak saya jalankan.

### Tes otomatis

Dua tes baru ditulis lebih dulu dan gagal pada kode lama:

- `never opens the WebSocket when the microphone cannot be acquired`: `connect` terpanggil satu kali padahal microphone gagal.
- `opens the WebSocket only after the microphone has been acquired`: socket dibuka sebelum `getUserMedia`.

Setelah perbaikan, keenam tes di `InterviewPage.test.tsx` lolos.

### Keterbatasan

- Tes otomatis masih memakai mock untuk `useAudioWebSocket`. Tes ini memeriksa urutan panggilan, tetapi tidak menjalankan `onclose` yang asli. Jalur tersebut hanya terbukti lewat pengujian manual di atas.
- Kegagalan microphone disimulasikan lewat Console, bukan dengan mencabut perangkat.
