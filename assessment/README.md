# Deliverable Tertulis — Case Study Fullstack Product Engineer

Folder ini berisi catatan eksekusi, dari eksplorasi awal sampai keputusan
arsitektur. Dokumen ditulis dalam Bahasa Indonesia; kode, komentar, dan pesan
commit dalam Bahasa Inggris supaya konsisten dengan codebase yang sudah ada.

## Urutan baca

| Dokumen | Isi |
|---|---|
| [step1-notes.md](step1-notes.md) | Setup lokal, hasil eksplorasi mentah sebelum diverifikasi |
| [step2-context.md](step2-context.md) | Konteks produk, industri, pengguna, kandidat, dan UU PDP |
| [step3-gap-analysis.md](step3-gap-analysis.md) | 17 temuan berperingkat P0–P3, pemisahan *missing spec* vs *defective*, constraint signal |
| [step4-revamp-strategy.md](step4-revamp-strategy.md) | Scope revamp, acceptance criteria, evaluasi opsi & trade-off, rencana migrasi |

## Cara membaca temuan

Temuan di step 3 mendeskripsikan **kondisi baseline** (branch `main`), bukan
kondisi setelah perubahan di branch ini. Yang ditutup oleh revamp ini dan yang
sengaja ditinggalkan sebagai follow-up dirinci di tabel scope pada step 4.

Setiap temuan diverifikasi lewat runtime (curl ke API), inspeksi database, atau
pembacaan kode — bukan dugaan dari struktur folder.

## Sinkronisasi dokumen dengan kode

Klaim di dokumen ini dijaga agar tidak melebihi apa yang benar-benar dikerjakan
kode. Kalau sebuah temuan hanya ditutup sebagian, dokumen menyebut bagian mana
yang ditutup dan mana yang tidak.
