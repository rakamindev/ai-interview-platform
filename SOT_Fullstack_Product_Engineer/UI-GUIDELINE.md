# UI/UX Guideline
## AI Interview Platform — Case Study

**Prinsip:** perbaiki pengalaman yang benar-benar berkaitan dengan masalah terpilih. Pertahankan design system yang sudah ada jika masih layak; jangan melakukan redesign menyeluruh tanpa alasan produk.

## 1. Tujuan pengalaman

Antarmuka harus membantu assessor, recruiter, dan hiring manager:
- Memahami status workflow dengan cepat.
- Mengetahui data mana yang lengkap, belum lengkap, atau gagal diproses.
- Membaca hasil penilaian tanpa disesatkan oleh data yang hilang atau error.
- Melakukan tindakan yang tepat dengan feedback yang jelas.
- Menggunakan aplikasi pada layar desktop maupun ukuran layar yang lebih kecil.

Kandidat juga merupakan pihak yang terdampak. Hindari bahasa yang merendahkan, klaim AI yang terlalu pasti, atau tampilan yang menyembunyikan keterbatasan penilaian.

## 2. Audit UI sebelum perubahan

Sebelum membuat komponen baru:
1. Jalankan web app dan ambil screenshot baseline.
2. Identifikasi halaman dan alur yang berkaitan dengan masalah.
3. Periksa komponen Radix UI, utility Tailwind, typography, spacing, warna, dan pola interaksi yang telah tersedia.
4. Catat inkonsistensi visual yang berdampak pada workflow.
5. Gunakan komponen yang ada jika memungkinkan; hindari duplikasi design system.

## 3. Hierarki visual

- Satu judul utama yang menjelaskan konteks halaman.
- Kelompokkan informasi berdasarkan tugas pengguna, bukan struktur database.
- Prioritaskan status, hasil, dan tindakan utama.
- Gunakan label yang eksplisit; jangan hanya mengandalkan warna.
- Bedakan informasi utama, metadata, dan tindakan sekunder.
- Hindari kartu, badge, grafik, atau dekorasi yang tidak membantu keputusan.

## 4. Status dan feedback

Untuk workflow yang terdampak, tentukan tampilan yang tepat bagi:
- **Loading:** jelaskan proses yang sedang berjalan; cegah klik berulang bila relevan.
- **Empty:** jelaskan mengapa belum ada data dan langkah berikutnya.
- **Error:** gunakan bahasa yang dapat dimengerti, berikan tindakan pemulihan bila aman.
- **Partial/incomplete:** tunjukkan bagian yang belum lengkap dan dampaknya pada hasil.
- **Success:** konfirmasi perubahan yang benar-benar sudah tersimpan.
- **Disabled:** jelaskan alasan tindakan tidak tersedia bila tidak jelas dari konteks.

Jangan menampilkan success state sebelum server mengonfirmasi hasil yang diperlukan.

## 5. Data dan hasil AI

- Bedakan hasil yang dihitung dari data yang dimasukkan manusia dan teks yang dihasilkan AI.
- Tampilkan data yang belum tersedia sebagai belum tersedia, bukan nilai nol atau nilai rekaan.
- Jangan mengarang rating, skor, atau rekomendasi.
- Jika hasil tidak lengkap, jelaskan bagian yang hilang dan konsekuensinya.
- Jika model gagal, sediakan status error dan retry yang aman jika didukung.
- Hindari bahasa yang menyiratkan keputusan AI adalah kebenaran mutlak.
- Jangan membocorkan prompt internal, secret, atau data kandidat ke UI/log yang tidak semestinya.

## 6. Form dan validasi

- Label setiap field dengan jelas.
- Validasi format dan aturan bisnis di frontend untuk feedback cepat, dan tetap validasi ulang di backend.
- Tampilkan error dekat field terkait dengan bahasa yang spesifik.
- Pertahankan input pengguna ketika request gagal bila aman.
- Cegah submit ganda untuk operasi yang tidak idempotent.
- Pastikan fokus keyboard dapat berpindah secara masuk akal setelah error.

## 7. Responsive dan aksesibilitas

- Periksa layout pada desktop, tablet, dan viewport mobile yang relevan.
- Pastikan tabel, teks panjang, dialog, dan tombol tidak keluar dari viewport.
- Gunakan elemen semantik dan label yang dapat dibaca screen reader.
- Pastikan interaksi keyboard, fokus terlihat, dan kontras warna memadai.
- Jangan menyampaikan status hanya dengan warna.
- Hindari animasi yang mengganggu; hormati reduced-motion jika animasi digunakan.

## 8. Teks panjang dan data ekstrem

Uji nama/teks panjang, deskripsi panjang, jumlah item besar, nilai kosong, dan data tidak biasa yang relevan. Gunakan wrapping atau truncation hanya jika tidak menyembunyikan informasi penting; sediakan cara melihat isi lengkap jika perlu.

## 9. Konsistensi komponen

- Gunakan pola tombol, input, dialog, toast, tabel, dan badge yang sudah ada.
- Jangan menambahkan library UI baru tanpa alasan yang kuat.
- Hindari komponen dengan banyak kondisi bercampur; pecah sesuai tanggung jawab bila meningkatkan keterbacaan.
- Jangan mengubah styling global yang tidak berhubungan dengan vertical slice.

## 10. Checklist review UI

- [ ] Alur utama bisa dipahami tanpa penjelasan lisan.
- [ ] Loading, empty, error, partial, dan success states ditangani sesuai kebutuhan.
- [ ] Validasi dan feedback jelas.
- [ ] Teks panjang dan data ekstrem tidak merusak layout.
- [ ] Responsive diuji dengan screenshot.
- [ ] Keyboard/focus dan kontras diperiksa.
- [ ] Tidak ada data pribadi nyata dalam screenshot.
- [ ] Tidak ada klaim AI yang berlebihan atau menyesatkan.
- [ ] Desain tetap konsisten dengan sistem yang ada.
- [ ] Perubahan visual mendukung masalah produk yang dipilih.
