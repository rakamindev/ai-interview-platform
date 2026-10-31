# Panduan memahami dan mempertahankan pekerjaan

Pekerjaan ini dikembangkan dengan bantuan AI. Baca kodenya, jalankan demonstrasinya, dan gunakan laporan sebagai catatan keputusanmu sendiri setelah kamu memverifikasinya.

## Alur kode yang perlu dikuasai

1. `FitGapReportPage` meminta portfolio dari session, lalu meminta perbandingan dengan vacancy. Tidak ada polling atau pembuatan job berulang ketika permintaan gagal.
2. `PortfoliosController` memeriksa peran, tenant JWT, kepemilikan portfolio lewat session, dan kepemilikan vacancy.
3. `FitGap::Engine` mengunci portfolio, memeriksa tenant kedua record, membaca rating terbaru, lalu menyimpan report dalam transaksi.
4. `FitGap::Comparison` merupakan logika Ruby tanpa ketergantungan Rails. Setiap requirement menjadi satu baris. ID skill didahulukan, lalu label custom yang tidak ambigu.
5. `delta = candidate_level - expected_level`. Nol berarti match; positif exceed; negatif gap; nilai tidak valid atau skill tidak ada berarti not_assessed dengan delta null.
6. Override assessor menggantikan rating AI. Confidence tetap milik rating AI, bukan klaim bahwa penilaian manusia sudah terverifikasi.
7. UI menampilkan expected_level, sumber rating, confidence, dan alasan tindak lanjut. Ekspor memakai hasil terbaru dengan aturan yang sama.

## Pertanyaan yang mungkin muncul

**Mengapa memilih masalah ini?** Laporan digunakan untuk mengevaluasi kandidat. Kolom level yang kosong, bukti yang tidak lengkap, dan kebocoran antar-tenant merusak keputusan pengguna serta privasi kandidat.

**Mengapa tidak mempertahankan narasi budaya dari Gemini?** Input lama hanya mengandung perbandingan level. Data tersebut tidak cukup untuk menyimpulkan budaya atau memberi rekomendasi perekrutan. Solusi yang dipilih menghitung hal yang dapat dijelaskan, lalu mengarahkan penilaian budaya ke tinjauan manusia atas bukti perilaku.

**Mengapa sinkron?** Perbandingan ini kecil dan deterministik. Menghilangkan panggilan model membuatnya tidak perlu menunggu provider atau antrean. Jika beban bertambah besar, ukur dahulu, lalu pertimbangkan snapshot dan job dengan status yang persisten.

**Mengapa tidak menganggap skill yang tidak dinilai sebagai L1?** Tidak adanya pengukuran berbeda dengan bukti kemampuan rendah. L1 adalah sebuah penilaian, sehingga tidak boleh dibuat dari data kosong.

**Bagaimana dengan dua nama skill yang sama?** Nama tampilan bukan identitas. Dua ID berbeda tidak boleh digabung. Jika pencocokan custom menghasilkan lebih dari satu kemungkinan, laporkan ambigu dan minta tindak lanjut.

**Mengapa row lock?** Permintaan ulang dan legacy job untuk portfolio yang sama diserialkan. Unique index pasangan portfolio/vacancy tetap menjadi pertahanan di database. Update report bersifat atomik; kegagalan menyimpan tidak menghapus report lama.

**Mengapa tidak membuat migration?** Tidak ada kebutuhan kolom baru. JSONB yang tersedia menyimpan metadata perbandingan; kolom narasi lama dipertahankan agar rollout tidak memerlukan penghapusan data/schema.

**Apa yang belum kamu buktikan?** Lihat laporan hasil pengujian. Jangan menyebut browser fixture sebagai pengujian API, jangan mengaku telah mewawancarai recruiter, dan jangan mengklaim alur wawancara suara/Gemini telah diuji bila tidak dijalankan.

**Apa seeded fault-nya?** Arah pengurangan delta sengaja dibalik pada branch percobaan. Test untuk hasil gap/exceed gagal. Commit kesalahan direvert dan test kembali lolos; kedua commit dipertahankan dalam riwayat.

**Apa langkah berikutnya dalam proyek nyata?** Validasi kebutuhan dengan recruiter dan kandidat, benahi generator portfolio yang mengubah keluaran AI tidak valid menjadi L1, lalu audit akses tenant di seluruh endpoint lain sebelum rilis lebih luas.
