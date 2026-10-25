# TODO — Testing Perbaikan

> Status: **In Progress**
> Terakhir diperbarui: 18 Agu 2026

---

## Phase 1 — Quick Fixes

- [x] **1.1** Hapus "Demo Tenant" dari header navbar — **SKIPPED (diimplementasikan user)**
  - File: `web/src/components/layout/AssessorLayout.tsx:66-69`
  - Hapus blok `{tenant.name && ...}` yang render tenant name pill

- [x] **1.2** Fix filter status "awaiting" → 500 error
  - File: `api/app/controllers/api/v1/assessments_controller.rb:154`
  - Ubah `latest.id IS NULL` → `latest.status IS NULL`
  - LATERAL JOIN subquery tidak select `id`, jadi column tidak ditemukan

## Phase 2 — Bug Fixes

- [x] **2.1** Fix Download PDF → 500 Windows-1252 error
  - File: `api/app/services/exports/pdf_generator.rb`
  - Root cause: Prawn pakai font AFM default (Helvetica), hanya support Windows-1252
  - Fix: Copy font DejaVu Sans TTF → `api/app/assets/fonts/` + register di `PdfGenerator#call` (`pdf.font_families.update` + `pdf.font 'DejaVu'`)

- [x] **2.2** Fix skill count badge di list (assessment & vacancy) — selalu "0 skill"
  - File: `api/.../assessments_controller.rb`, `api/.../vacancies_controller.rb`, `AssessmentListPage.tsx`, `VacancyListPage.tsx`, `types/index.ts`
  - List endpoint (`index`) tidak return `skills`/count, tapi FE baca `skills?.length`
  - Fix: tambah `skills_count` di `assessment_json` & `vacancy_json` (+ eager-load), FE baca `skills_count`

## Phase 3 — UX Improvements

- [x] **3.1** Tambah logout confirmation dialog
  - File: `web/src/components/layout/AssessorLayout.tsx:20-24, 71-77`
  - Component `AlertDialog` sudah ada di `components/ui/alert-dialog.tsx`
  - Wrap logout button dengan dialog "Are you sure you want to logout?"

- [x] **3.2** Fix assessment edit — role title langsung bisa diedit
  - File: `web/src/pages/assessments/AssessmentEditPage.tsx:188-211`
  - Combobox render sebagai Button, user harus klik dulu baru bisa edit
  - Fix: Refactor Combobox jadi text input dengan suggestion (autocomplete)

- [x] **3.3** Tambah debounce/AbortController untuk filter assessment
  - File: `web/src/pages/assessments/AssessmentListPage.tsx`
  - Status filter pills tidak ada debounce, rapid click = N requests
  - Fix: Tambah AbortController ref untuk cancel in-flight request

## Phase 4 — Enhancements

- [ ] **4.1** Install & setup toast notifications (sonner)
  - Install: `sonner`
  - Setup: `<Toaster />` di `web/src/main.tsx`

- [ ] **4.2** Tambah toast ke semua action points
  - Login success → `LoginPage.tsx`
  - Assessment create success → `AssessmentNewPage.tsx`
  - Assessment edit success → `AssessmentEditPage.tsx`
  - Assessment delete success → delete handler
  - Vacancy create/edit success → vacancy pages
  - Logout success → `AssessorLayout.tsx`

## Phase 5 — Mobile Responsive

- [x] **5.1** Global header (`AssessorLayout.tsx`)
  - `px-7` → `px-4 sm:px-7` di header & main container
  - Header row `h-14 flex justify-between` → `min-h-14 h-auto` + `flex-wrap gap-y-2`
  - Sembunyikan teks "Rakamin AI Interview" di layar sempit (`hidden sm:block`)
  - Tenant pill → `hidden md:block`

- [x] **5.2** AssessmentInvitePage — stats & layout
  - Stats `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
  - Two-column `grid-cols-[1fr_320px]` → `grid-cols-1 lg:grid-cols-[1fr_320px]`
  - Header (title + Edit/New session) tambah `flex-wrap`

- [x] **5.3** AssessmentInvitePage — candidates table
  - Bungkus `<table>` dengan wrapper `overflow-x-auto`

- [x] **5.4** PortfolioPage — two-column
  - `grid-cols-[1fr_280px]` → `grid-cols-1 lg:grid-cols-[1fr_280px]`
  - Header action buttons tambah `flex-wrap`

- [x] **5.5** FitGapReportPage — two-column
  - `grid-cols-[1fr_260px]` → `grid-cols-1 lg:grid-cols-[1fr_260px]`
  - Header action buttons tambah `flex-wrap`

- [x] **5.6** AssessmentListPage — search/filter bar
  - Search + filter `flex items-center gap-3` → `flex flex-col sm:flex-row sm:items-center`
  - Mobile: filter badge di atas (`order-1`), search box di bawah (`order-2`) full-width
  - Search box `w-full sm:flex-1 sm:max-w-xs` (proporsional di mobile)

- [x] **5.7** AssessmentNewPage — grid kolom — **SKIPPED (acceptable, no need to fix)**
  - `grid grid-cols-2` (time limit + language) → `grid-cols-1 sm:grid-cols-2`

- [x] **5.8** Minor (opsional)
  - `LoginPage`: `p-8` → `p-6 sm:p-8` + `px-4` di container
  - `LiveMonitorPage` / `InterviewPage` bottom bar & header: tambah `flex-wrap`

---

## Progress

| Phase | Issues | Status |
|-------|--------|--------|
| Phase 1 — Quick Fixes | 1.1 (skipped), 1.2 | ✅ Selesai (1.2 done) |
| Phase 2 — Bug Fixes | 2.1, 2.2 | ✅ Selesai |
| Phase 3 — UX Improvements | 3.1, 3.2, 3.3 | ✅ Selesai |
| Phase 4 — Enhancements | 4.1, 4.2 | ⏳ Belum dikerjakan |
| Phase 5 — Mobile Responsive | 5.1–5.8 | ✅ Selesai (5.7 skipped) |

---

*Dibuat: 18 Agu 2026*
