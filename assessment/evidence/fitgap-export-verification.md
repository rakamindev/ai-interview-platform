# Verifikasi manual fit/gap dan ekspor

Tanggal: 27 Oktober 2026. Sesi 18, portfolio 18, vacancy 1. Evidence diringkas dari screenshot/JSON yang dibagikan pengguna serta pembacaan struktur PDF unduhan; tidak menyalin identitas atau kutipan jawaban kandidat.

| Pemeriksaan | Bukti yang tersedia | Hasil dan batas |
| --- | --- | --- |
| Fit/gap tampil | Screenshot halaman Fit/Gap Report | Tiga perbandingan dan ringkasan muncul; Required kosong pada web (F10) |
| Target dan delta | JSON dan teks PDF | React expected 3/candidate 1/delta -2; System Design 2/1/-1; Communication 3/1/-2 |
| Unduh PDF | Pengguna mengonfirmasi file berhasil diunduh | Berhasil pada percobaan ini |
| Isi PDF | pypdf memeriksa file fitgap-18-1.pdf, lalu pengguna membagikan teks halaman kedua | Dua halaman: portfolio di halaman 1; Fit/Gap Analysis serta header Required/Candidate/Delta di halaman 2. Dugaan fit/gap hilang dari PDF tidak terbukti |
| Unduh JSON | Pengguna mengonfirmasi unduh dan membagikan isi | Portfolio complete dengan tiga skill; fit_gap_report terisi dan tiga perbandingan sesuai PDF |
| Metadata error | JSON yang dibagikan pengguna | generation_status complete tetapi generation_error API returned 400; error lama belum dibersihkan (F12) |
| Evidence skill | Portfolio dan JSON | System Design evidence kosong tetapi level 1 menjadi gap; F09/F11 tetap terbuka |

## Kesimpulan terbatas

Alur manual pada sesi ini mencapai fit/gap serta unduh dan isi PDF/JSON yang memuat portfolio dan laporan pembanding vacancy. Keberhasilan fungsi ekspor tidak membuktikan akurasi penilaian. Kolom Required kosong di web, L1 tanpa evidence yang ikut dihitung sebagai gap, dan error lama pada hasil complete masih tercatat sebagai temuan terbuka.

Tidak ada temuan baru bahwa PDF kehilangan halaman fit/gap; pemeriksaan file menunjukkan bagian tersebut di halaman kedua. Pemeriksaan teks PDF tidak menggantikan render/QA visual untuk clipping, font, atau layout di seluruh skenario. Long text, data kosong, otorisasi, ekspor saat gagal, mobile, dan semua jalur override belum diverifikasi lewat percobaan ini.

culture_narrative pada JSON bernilai null. Penyebab dan kebutuhan produk belum ditelusuri, sehingga belum ditetapkan sebagai bug. candidate_id null juga tidak dinyatakan bug tanpa menilai kontrak data.

Raw JSON/transkrip pengguna tidak disalin ke repository. Screenshot teranonimisasi dan tautan PR perlu ditambahkan untuk reviewer eksternal.

## Percobaan portfolio berikutnya: dibatasi provider

27 Oktober 2026: metadata terbaru menunjukkan sesi 23 ended/manual_assessor dan sesi 24 ended/manual_candidate, keduanya portfolio failed dengan Rate limited. Worker aktif dan job benar-benar dijalankan, tetapi log menunjukkan Gemini::HttpClient::RateLimitError berulang. Ini bukan bukti kualitas jawaban buruk atau bukti bahwa perbaikan reload menyebabkan kegagalan generate. Jenis batas (RPM/TPM/RPD/akses proyek) belum diketahui karena error yang tersimpan generik. Perlu membaca penggunaan kuota pada dashboard pengguna, tanpa membaca/menggunakan API key. Hasil portfolio/fit-gap/ekspor sesi 18 tetap merupakan keberhasilan skenario sebelumnya; jangan mengubahnya menjadi klaim semua sesi berhasil.
