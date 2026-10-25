# RINGKASAN PERUBAHAN — FIX TESTING & MOBILE RESPONSIVE

> **Konteks:** Lanjutan dari `ringkasan-ui-ux-polish.md`. Dokumen ini mendokumentasikan
> perbaikan yang dilakukan **setelah sesi testing manual** (catatan ada di
> `web/doc/testing/testing.md` dan `web/doc/testing/todo-testing.md`): bug fix yang
> ditemukan saat testing, perbaikan UX pada filter/combobox, penambahan pagination,
> dan pembuatan tampilan **mobile responsive** — semua sejalan dengan standar
> **Monozukuri** (craftsmanship) dari brief case study.

---

## DAFTAR ISI

1. [Konteks & Motivasi](#1-konteks--motivasi)
2. [Ringkasan Perubahan](#2-ringkasan-perubahan)
   - 2.1 [Bug Fixes](#21-bug-fixes)
   - 2.2 [UX Improvements](#22-ux-improvements)
   - 2.3 [Pagination](#23-pagination)
   - 2.4 [Mobile Responsive](#24-mobile-responsive)
3. [Alasan & Dampak](#3-alasan--dampak)
4. [Manfaat untuk Pengguna](#4-manfaat-untuk-pengguna)
5. [Backlog / Catatan](#5-backlog--catatan)

---

## 1. KONTEKS & MOTIVASI

Setelah UI/UX polish selesai, dilakukan **testing manual** oleh user. Hasilnya dicatat di
`web/doc/testing/testing.md` — berisi bug (500 error), catatan UX, dan permintaan fitur.
Semua temuan dipecah menjadi todo terstruktur di `web/doc/testing/todo-testing.md`
(Phase 1–5) agar proses bisa direview bertahap.

Masalah yang ditemukan:

- **Bug backend** yang membuat fitur rusak total:
  - Filter status "Awaiting" → 500 error (`column latest.id does not exist`)
  - Download PDF portfolio/fit-gap → 500 error (karakter di luar Windows-1252)
  - Badge jumlah skill di list assessment & vacancy selalu menampilkan "0 skill"
- **UX yang menyakitkan**:
  - Search/filter di list assessment: fokus hilang setiap selesai mengetik, dan saat hasil kosong komponen pencarian hilang seluruhnya
  - Combobox role title tidak bisa diedit langsung (harus klik dulu)
  - Tombol dialog saling menempel tanpa jarak
  - Tidak ada konfirmasi logout
- **Fitur hilang**: tidak ada pagination sama sekali di list (FE selalu request page 1)
- **Tidak mobile-responsive**: hampir nol penggunaan breakpoint (`sm:`/`md:`/`lg:`) — grid kolom tetap dan flex tanpa wrap pecah di layar sempit.

---

## 2. RINGKASAN PERUBAHAN

### 2.1 Bug Fixes

#### 2.1.1 Filter status "Awaiting" 500 error — `api/app/controllers/api/v1/assessments_controller.rb`

- **Apa:** `status_sql` untuk status `awaiting` berubah dari `latest.id IS NULL` → `latest.status IS NULL`.
- **Kenapa:** Subquery `LATERAL JOIN` untuk mengambil session terakhir hanya select kolom
  `status` dan `end_reason` — tidak ada `id`. Kondisi `latest.id IS NULL` memicu
  `PG::UndefinedColumn`. Dengan `LEFT JOIN LATERAL`, `latest.status` otomatis `NULL`
  ketika assessment belum punya session, jadi logikanya identik tanpa error.

#### 2.1.2 Download PDF 500 (Windows-1252) — `api/app/services/exports/pdf_generator.rb`

- **Apa:** Registrasi font TTF **DejaVu Sans** (normal + bold) di `api/app/assets/fonts/`,
  lalu dipakai via `register_fonts(pdf)` + `pdf.font 'DejaVu'` di awal `call`.
- **Kenapa:** Prawn default memakai font AFM bawaan (Helvetica) yang hanya mendukung
  charset Windows-1252. Evidence quote kandidat, skill label, dan competency summary
  (teks bebas hasil AI) sering mengandung karakter di luar itu (em-dash `—`, teks non-latin)
  → seluruh PDF gagal dibuat. Font TTF mendukung full UTF-8.
- **Catatan:** Dockerfile memakai `COPY . .` sehingga font otomatis ikut ke image produksi.

#### 2.1.3 Badge jumlah skill selalu "0" — `assessments_controller.rb`, `vacancies_controller.rb`, `types/index.ts`, list pages

- **Apa:** `assessment_json` dan `vacancy_json` sekarang mengembalikan `skills_count`;
  `index` melakukan eager-load (`:assessment_skills` / `:vacancy_skills`) agar tidak N+1.
  Frontend membaca `skills_count` (bukan `skills?.length` yang sebelumnya selalu `undefined`).
- **Kenapa:** Endpoint list tidak mengembalikan `skills` maupun count, sedangkan badge
  FE membaca `skills?.length` → selalu "0 skill".

#### 2.1.4 Sumber suggestion role title dipisah — `assessments_controller.rb`, `routes.rb`, `assessments.ts`

- **Apa:** Tambah endpoint `GET /api/v1/assessments/role_titles` (distinct `name`).
  Halaman assessment (new/edit) sekarang memakai `assessmentsApi.roleTitles()`,
  sedangkan halaman vacancy tetap `vacanciesApi.roleTitles()`.
- **Kenapa:** Role title suggestion harus kontekstual — assessment menyarankan nama
  assessment yang sudah ada (kolom `name`), vacancy menyarankan role title vacancy.

### 2.2 UX Improvements

#### 2.2.1 Combobox refactor → text input dengan suggestion — `web/src/components/ui/combobox.tsx`

- **Apa:** Combobox ditulis ulang dari "button trigger + popover" menjadi **input teks
  murni** yang bisa langsung diketik, dengan dropdown suggestion di bawahnya saat focus.
  Satu sumber kebenaran = `value` (tidak ada state `query` terpisah).
- **Fitur keyboard:** `ArrowDown`/`ArrowUp` navigasi highlight (wrap-around + auto-scroll),
  `Enter` pilih, `Escape` tutup; hover juga set highlight.
- **Fokus:** focus memakai `focus:bg-gray-50` (bukan ring hitam) agar konsisten.
- **Kenapa:** Masalah edit role title — sebelumnya value cuma tampil sebagai teks statis,
  user harus buka popover dulu baru bisa mengubah. Sekarang langsung bisa diedit.
- **File caller:** `AssessmentNewPage`, `AssessmentEditPage`, `VacancyNewPage`,
  `VacancyEditPage` — `onSelect` → `onChange`, prop `searchPlaceholder`/`allowCustom` dihapus.

#### 2.2.2 Filter search: fokus hilang + empty state — `AssessmentListPage.tsx`

- **Apa:** Search bar + filter pills dipindah **keluar** dari ternary loading/empty/list,
  sehingga selalu dirender (tidak pernah unmount saat loading). Ditambah empty state
  "No matching assessments" + tombol "Clear search & filters" saat ada filter aktif.
  Baris hitung jumlah assessment kini selalu dirender (Skeleton saat loading) agar tidak
  terjadi layout shift (search bar naik-turun).
- **Kenapa:** Sebelumnya `setLoading(true)` me-replace seluruh subtree (termasuk input)
  → fokus hilang; dan saat hasil kosong, search bar hilang sehingga user tidak bisa
  mengubah keyword.

#### 2.2.3 AbortController pada filter — `AssessmentListPage.tsx`, `assessments.ts`

- **Apa:** `assessmentsApi.list` menerima `signal`; tiap fetch baru meng-abort request
  sebelumnya; `ERR_CANCELED` diabaikan; `finally` hanya set loading bila controller
  masih yang terbaru; abort saat unmount.
- **Kenapa:** Mencegah race condition (respons stale menimpa respons baru) saat filter
  berubah cepat.

#### 2.2.4 Logout confirmation dialog — `web/src/components/layout/AssessorLayout.tsx`

- **Apa:** Tombol logout dibungkus `AlertDialog` ("Are you sure you want to logout?")
  dengan aksi Cancel / Logout.

#### 2.2.5 Dialog footer gap — `dialog.tsx`, `alert-dialog.tsx`

- **Apa:** `sm:space-x-2` → `gap-2` pada `DialogFooter` / `AlertDialogFooter`.
- **Kenapa:** `space-x-2` hanya memberi jarak horizontal di desktop; di mobile
  (`flex-col-reverse`) tombol menempel tanpa jarak vertikal. `gap-2` berlaku di kedua arah.

#### 2.2.6 Dialog mobile spacing — `dialog.tsx`, `alert-dialog.tsx`

- **Apa:** `w-full` → `w-[calc(100%-2rem)] sm:w-full` pada `DialogContent` / `AlertDialogContent`.
- **Kenapa:** Di mobile, `w-full` membuat dialog melebar sampai tepi layar tanpa jarak.
  Sekarang ada jarak 16px kiri-kanan, dan desktop tetap `max-w-lg`.

### 2.3 Pagination

#### 2.3.1 Assessment list pagination — `AssessmentListPage.tsx`, `assessments.ts`

- **Apa:** `per_page` dikirim (default kini 20), state `page` + `totalPages` dari
  `meta.total_pages`, UI pagination (Prev / nomor halaman / Next) muncul hanya jika
  `totalPages > 1`. Search (debounced 300ms) dan ganti filter mereset ke page 1.
- **Kenapa:** FE sebelumnya selalu request page 1 tanpa navigasi — padahal backend
  sudah mendukung `page` + `per_page`.

#### 2.3.2 Vacancy list pagination — `VacancyListPage.tsx`, `vacancies.ts`

- **Apa:** Sama dengan assessment: `per_page`, state page, UI pagination, count
  memakai `total_count` (bukan panjang halaman), AbortController untuk unmount safety.

### 2.4 Mobile Responsive

> Target: semua halaman utama tampil benar di layar sempit. Sebelumnya hanya ~10
> kemunculan breakpoint di seluruh FE (kebanyakan di komponen UI bawaan shadcn).

#### 2.4.1 Global header + hamburger menu — `AssessorLayout.tsx`

- **Apa:**
  - Header `h-14` → `min-h-14 h-auto` + `flex-wrap`, padding `px-4 sm:px-7`.
  - Teks "Rakamin AI Interview" tetap visible (semua ukuran); tenant pill `hidden md:block`.
  - Nav inline `hidden md:flex`; logout inline `hidden md:flex`.
  - Tombol **hamburger** (`md:hidden`) membuka `DropdownMenu` di pojok kanan atas
    berisi nav items (Assessments, Vacancies) + Logout (tetap pakai konfirmasi).
- **Kenapa:** Satu baris berisi logo + teks + 2 nav + tenant pill + logout overflow di mobile.

#### 2.4.2 AssessmentInvitePage — `AssessmentInvitePage.tsx`

- Stats `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`.
- Two-column `grid-cols-[1fr_320px]` → `grid-cols-1 lg:grid-cols-[1fr_320px]`.
- Tabel kandidat dibungkus `overflow-x-auto`.
- Header (title + tombol) tambah `flex-wrap`.

#### 2.4.3 PortfolioPage — `PortfolioPage.tsx`

- Two-column `grid-cols-[1fr_280px]` → `grid-cols-1 lg:grid-cols-[1fr_280px]`.
- Header action buttons `flex-wrap`.

#### 2.4.4 FitGapReportPage — `FitGapReportPage.tsx`

- Two-column `grid-cols-[1fr_260px]` → `grid-cols-1 lg:grid-cols-[1fr_260px]`.
- Header action buttons `flex-wrap`.

#### 2.4.5 AssessmentListPage search/filter — `AssessmentListPage.tsx`

- Bar `flex items-center` → `flex flex-col sm:flex-row`; di mobile filter badge di atas
  (`order-1`), search box full-width di bawah (`order-2`); desktop kembali search kiri,
  filter kanan.

#### 2.4.6 Vacancy form — expected skills row — `VacancyNewPage.tsx`, `VacancyEditPage.tsx`

- Baris skill `flex items-center` → `flex flex-col sm:flex-row sm:items-center`; di mobile
  label di baris atas, lalu LevelRadio (kiri) + tombol hapus (kanan) di baris kedua.

#### 2.4.7 Assessment form — tombol add skill — `AssessmentNewPage.tsx`, `AssessmentEditPage.tsx`

- Container `flex gap-2` → `flex flex-col sm:flex-row`; tombol `w-full sm:w-auto` agar
  tidak overflow di mobile.

#### 2.4.8 Minor — `LoginPage.tsx`, `LiveMonitorPage.tsx`, `InterviewPage.tsx`

- `LoginPage`: card `p-8` → `p-6 sm:p-8`, container tambah `px-4`.
- `LiveMonitorPage`: header `flex-wrap`.
- `InterviewPage`: bottom bar `flex-wrap`.

---

## 3. ALASAN & DAMPAK

### 3.1 Mengapa bug fix dulu, baru enhancement

Bug yang membuat fitur **tidak berfungsi** (500 error) harus diselesaikan sebelum
polish, karena berdampak langsung ke kelayakan demo:

- Filter "Awaiting" yang error menghalangi alur utama admin dalam mengelola assessment.
- PDF export yang error menghilangkan fitur pelaporan.
- Badge "0 skill" memberi informasi yang salah ke admin.

### 3.2 Mengapa Combobox di-refactor jadi text input + suggestion

Prinsip **KISS** (keep it simple). Combobox lama (button + popover + state `query`
terpisah) rumit secara state dan menyulitkan UX edit. Input teks murni dengan satu
sumber kebenaran (`value`) menyelesaikan masalah "tidak bisa edit langsung" sekaligus
menyederhanakan komponen.

### 3.3 Mengapa pagination penting

List tanpa pagination menampilkan seluruh data dalam satu halaman → tidak scalable dan
tidak menunjukkan pemahaman terhadap pola list yang umum (page, per_page, total_pages).
Implementasi memanfaatkan dukungan `page`/`per_page` yang sudah ada di backend.

### 3.4 Mengapa mobile responsive wajib

Brief secara eksplisit menuntut *"handling all interaction states ... and responsive
views"*. Sebelumnya layout memakai grid kolom tetap (`grid-cols-[1fr_280px]`,
`grid-cols-3`) dan flex tanpa wrap, sehingga pecah di layar ≤ 640px. Pola yang dipakai:
`grid-cols-1 lg:grid-cols-[...]` dan `flex-col sm:flex-row` — stack di mobile, tetap
seperti semula di desktop.

---

## 4. MANFAAT UNTUK PENGGUNA

### Untuk Assessor/Admin
- **Filter berfungsi** (tidak 500) dan **focus tetap terjaga** saat mengetik keyword.
- **Role title bisa langsung diedit** tanpa harus buka dropdown dulu.
- **Pagination** memudahkan navigasi saat data banyak.
- **PDF export** menampilkan semua karakter dengan benar (tidak gagal karena teks kandidat).
- **Badge skill** menunjukkan jumlah yang benar.
- **Tampilan mobile** rapi: grid menumpuk, header punya hamburger menu, dialog tidak menempel tepi.

### Untuk Kandidat
- **Interview page** bottom bar bisa wrap di layar sempit.
- **Login & dialog** tidak menempel tepi layar di mobile.

### Untuk Developer (Maintainability)
- **Satu sumber kebenaran** di Combobox (`value`) — lebih mudah di-maintain.
- **AbortController** mencegah race condition pada request filter.
- **Shared component** (dialog, alert-dialog) diperbaiki sekali, berlaku untuk semua pemakai.
- **Breakpoint konsisten** (`sm:`/`lg:`) memudahkan penambahan halaman baru.

---

## 5. BACKLOG / CATATAN

| Item | Status | Catatan |
|---|---|---|
| Phase 4 — Toast notifications (sonner) | Belum | Install `sonner` + `<Toaster />` + toast di action points (login, create/edit/delete, logout) |
| 5.7 Grid 2 kolom (time limit + language) di assessment form | Skipped | Dianggap acceptable, tidak perlu diubah |
| "Demo Tenant" header (1.1) | User handle sendiri | Di-skip dari todo |
| Vacancy role title di vacancy form | Selesai | Tetap pakai `vacanciesApi.roleTitles()` |
| Git commit | Belum | User handle sendiri |

---

*Dibuat: 18 Agu 2026.*
