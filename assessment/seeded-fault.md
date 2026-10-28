# Seeded fault: mikrofon kandidat tidak dibuka saat resume

Tanggal eksperimen: 27 Oktober 2026. Dipublikasikan 28 Oktober 2026: fault telah dipulihkan, [branch dan ketiga commit tersedia di GitHub](https://github.com/loma09/ai-interview-platform/tree/loma/seeded-fault-resume), ditautkan dari [PR fullstack #214](https://github.com/rakamindev/ai-interview-platform/pull/214).

## Tujuan dalam bahasa sederhana

Tes yang selalu hijau belum membuktikan bahwa ia akan menangkap kerusakan. Eksperimen ini sengaja menghilangkan satu perilaku penting, menjalankan tes yang sudah ada, lalu mengembalikan perilakunya. Hasil yang diharapkan adalah **hijau -> merah -> hijau**, dengan setiap perubahan terlihat dalam riwayat Git.

Ini eksperimen terpisah dari perbaikan awal. Assertion tidak diperlemah, tes tidak dilewati, dan hasil merah bukan disebabkan syntax error atau dependency yang hilang.

## Perilaku produk yang diuji

Frontend memulai capture dalam keadaan mute untuk menghindari input saat AI berbicara. Ketika browser membuka kembali sesi yang sudah memiliki resumption token, backend perlu memberitahu bahwa kandidat mendapat giliran. Kontrak pesan yang diuji:

```ruby
send_json(browser_ws, type: 'speaker_changed', speaker: 'candidate')
```

Tanpa pesan ini pada cabang resume, frontend tidak mendapat sinyal untuk membuka gerbang mikrofon. Kandidat bisa sudah terhubung tetapi tidak dapat mengirim jawaban melalui alur giliran yang semestinya.

File produksi: `api/app/channels/audio_websocket_middleware.rb`, cabang resume pada `build_on_ready`.

Tes existing: `api/spec/channels/audio_resume_spec.rb`:

```ruby
expect(messages).to include(type: 'speaker_changed', speaker: 'candidate')
expect(messages).to include(type: 'session_started', session_id: 123)
expect(state.model_speaking).to be(false)
```

Transport WebSocket dan session pada tes bersifat sintetis. Callback produksi yang menyusun pesan dijalankan; ini bukan pengujian mikrofon nyata atau percakapan Gemini langsung.

## Isolasi dan scope

- Saat eksperimen dilakukan, branch aplikasi tetap `loma/project-setup` dan perubahan yang belum dicommit di checkout utama dipertahankan. Perubahan aplikasi kini telah dicommit dan dipublikasikan terpisah dari scratch branch.
- Scratch branch `loma/seeded-fault-resume` berada dalam worktree terpisah. Direktori checkout aplikasi utama tidak dipindahkan ke commit rusak.
- Baseline scratch berisi snapshot terpilih dari source backend dan tes yang sudah diverifikasi. Ini bukan commit seluruh perubahan frontend/backend untuk PR final.
- Container uji bersifat sementara, memakai `--network none` serta bind mount source/spec read-only. Tidak ada database, file secret, atau runtime API/Sidekiq yang dimodifikasi oleh eksperimen ini.
- Worktree akhir bersih dan source API sama dengan baseline sebelum fault. Worktree dipertahankan agar history dan source masih dapat diperiksa.

## Tiga tahap dan commit

| Tahap | Commit | Perubahan | Hasil suite backend |
| --- | --- | --- | --- |
| 1. Baseline benar | `5fa769d8d8df996c05102a80c6f92762684d5fdb` | Snapshot source backend terpilih dan tes existing | 8 contoh, 0 gagal; exit 0 |
| 2. Fault disengaja | `c533d0d31fa9916ef11bda18fb1c22b05b835b49` | Menghapus tepat satu baris pesan giliran kandidat pada resume | 8 contoh, 1 gagal; exit 1 |
| 3. Pemulihan | `722cec042f0e606ef62bc0d3e42b53ee4f632bac` | Mengembalikan baris yang dihapus | 8 contoh, 0 gagal; exit 0 |

Commit fault hanya mengubah file produksi, dengan satu deletion. Commit pemulihan menambahkan kembali satu baris. File tes identik sepanjang ketiga tahap. Pemulihan menggunakan `git revert --no-commit` lalu commit dengan pesan yang menyebut SHA fault; tidak melakukan reset atau menghapus riwayat fault.

## Apa yang terjadi saat fault dijalankan

Tes yang gagal bernama:

```text
AudioWebSocketMiddleware opens the candidate microphone when a browser resumes an existing session
```

Pesan yang benar-benar keluar dari callback rusak hanya `session_started`. Assertion masih mengharapkan `speaker_changed:candidate`, sehingga gagal dengan perbandingan pesan yang konkret. Tujuh tes lain tetap lulus. Ini menunjukkan tes menangkap kontrak yang dihilangkan, bukan seluruh harness yang rusak.

Raw output disimpan pada:

- [Baseline](evidence/seeded-fault-baseline.txt)
- [Fault: satu tes gagal](evidence/seeded-fault-red.txt)
- [Pemulihan: suite kembali lulus](evidence/seeded-fault-green.txt)
- [Riwayat commit ringkas](evidence/seeded-fault-history.txt)
- [Manifest dan hash source/tes](evidence/seeded-fault-manifest.json)

Setiap output run memuat `process_exit_code` agar hasil merah/hijau tidak bergantung pada warna terminal.

## Cara memeriksa tanpa mengubah branch utama

Dari root repository:

```powershell
git log loma/seeded-fault-resume -3 --oneline
git show c533d0d -- api/app/channels/audio_websocket_middleware.rb
git show 722cec0 -- api/app/channels/audio_websocket_middleware.rb
git diff 5fa769d 722cec0 -- api
git diff 5fa769d 722cec0 -- api/spec
```

Dua perintah `git diff` terakhir tidak menghasilkan perubahan. Untuk memastikan assertion tidak diubah pada commit fault:

```powershell
git diff 5fa769d c533d0d -- api/spec
```

Outputnya juga kosong. Jangan merge commit fault secara terpisah ke branch aplikasi.

### Perintah pengujian yang digunakan

`$scratchRoot` menunjuk worktree terpisah yang tercatat dalam manifest. Perintah berikut dipakai pada setiap tahap, setelah source berada pada kondisi tahap terkait:

```powershell
docker run --rm --network none `
  --mount "type=bind,source=$scratchRoot/api/app,target=/ai-interview/app,readonly" `
  --mount "type=bind,source=$scratchRoot/api/spec,target=/ai-interview/spec,readonly" `
  ai-interview-api:local bundle exec rspec --format documentation
```

Image menyediakan dependency Ruby; bind mount memastikan yang diuji adalah source scratch, bukan salinan source dalam image. Model, key, perangkat audio, dan koneksi internet tidak diperlukan.

## Penjelasan singkat untuk presentasi

> Saya memilih bug resume audio karena dampaknya langsung: kandidat terhubung tetapi mikrofon bisa tetap tertahan mute. Di scratch branch saya sengaja menghapus satu pesan yang mengembalikan giliran kandidat. Tes existing gagal pada pesan yang hilang, sementara tujuh tes lainnya tetap lulus. Saya lalu merevert perubahan itu dan seluruh delapan tes kembali lulus. Assertion tidak diubah, dan ketiga tahap ada di riwayat Git. Eksperimen membuktikan tes menangkap regresi kontrak pesan tersebut; bukan bukti bahwa semua kemungkinan kegagalan audio sudah teratasi.

## Batas dan publikasi

Eksperimen memenuhi bukti seeded fault secara lokal untuk satu perilaku backend. Ia tidak menggantikan live reconnect, uji browser mobile, atau endurance 45 menit. Snapshot scratch bukan PR produk lengkap.

**Masih perlu sebelum submission:** publikasikan branch/history ini bersama pekerjaan final sehingga reviewer dapat membuka commit tersebut, dan tambahkan link commit/branch pada PR/PDF. Saat ini SHA dapat diperiksa di repository lokal, belum menjadi tautan GitHub yang tersedia untuk reviewer eksternal.
