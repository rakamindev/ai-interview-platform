# RINGKASAN PERUBAHAN — UI/UX POLISH

> **Konteks:** Lanjutan dari `ringkasan-phase-0.md`. Dokumen ini mendokumentasikan
> perubahan UI/UX yang bertujuan meningkatkan kualitas visual dan pengalaman pengguna
> sesuai standar **Monozukuri** (craftsmanship) dari brief case study.

---

## DAFTAR ISI

1. [Konteks & Motivasi](#1-konteks--motivasi)
2. [Ringkasan Perubahan](#2-ringkasan-perubahan)
3. [Alasan & Dampak](#3-alasan--dampak)
4. [Manfaat untuk Pengguna](#4-manfaat-untuk-pengguna)

---

## 1. KONTEKS & MOTIVASI

Brief case study (Step 5, Monozukuri Implementation) menuntut:

> **"Polished UI/UX Interface:** Great visual taste, harmonious layout, handling all
> interaction states (loading, empty, error, partial, long text, and responsive views)
> using or extending the design system."

> **"Pride in Making (Monozukuri):** Deep care for the product, meticulous attention
> to detail, and a drive to craft software that feels complete and reliable."

Sebelum polish, frontend memiliki beberapa masalah:
- **Tidak ada custom font** — menggunakan browser default (terkesan template)
- **Login page plain** — tidak ada visual depth, tidak ada branding
- **Heading tidak konsisten** — 3 ukuran berbeda (text-xl, text-lg, text-2xl) di berbagai page
- **Tidak ada shared Breadcrumb** — 6+ pola berbeda untuk navigasi
- **Error states tidak konsisten** — 5 pola berbeda (banner, card, text, inline, silent)
- **Tidak ada 404 route** — path salah render blank page
- **Hardcoded `bg-white`** di 6 lokasi — dark mode broken
- **Tidak ada shared Alert/Empty State component** — setiap page build sendiri
- **Interview page raw HTML buttons** — bukan Button component, emoji bukan icon
- **Portfolio error unfriendly** — "Portfolio generation failed." tanpa penjelasan (rate limit, timeout, dll)

---

## 2. RINGKASAN PERUBAHAN

### P3.3 Custom Font — Inter

- **File:** `web/index.html`, `web/tailwind.config.js`, `web/src/index.css`
- **Apa:** Load **Inter** dari Google Fonts, set sebagai default font via Tailwind `fontFamily`.
- **Sebelum:** Browser default system font (times new roman / system-ui)
- **Sesudah:** Inter — clean, modern, excellent readability di semua size

### P3.4 Login Page Makeover

- **File:** `web/src/pages/auth/LoginPage.tsx`
- **Apa:**
  - Gradient background (`bg-gradient-to-br from-primary/5 via-background to-secondary/5`)
  - Card container (`border rounded-xl shadow-sm bg-card p-8`)
  - BrainCircuit icon dalam lingkaran primary
  - Placeholders di email + password inputs
  - Error menggunakan `Alert variant="danger"` (shared component)
  - Footer "AI Interview Platform"
- **Sebelum:** Plain white, no card, no icon, no visual depth
- **Sesudah:** Professional, branded, visually appealing

### P3.5 Standardize Page Headings

- **File:** `AssessmentInvitePage.tsx`, `LiveMonitorPage.tsx`, `PortfolioPage.tsx`, `TranscriptPage.tsx`, `FitGapReportPage.tsx`
- **Apa:** Semua page headings distandardisasi ke `text-xl font-semibold`
- **Sebelum:** 3 ukuran berbeda (text-xl, text-lg, text-2xl)
- **Sesudah:** Konsisten di semua page

### P3.6 Shared Breadcrumb Component

- **File:** `web/src/components/ui/breadcrumb.tsx` (new), 8 pages diupdate
- **Apa:** Component reusable untuk navigasi breadcrumb — di-adopt di:
  - `AssessmentNewPage`, `AssessmentEditPage`, `AssessmentInvitePage` (2 locations)
  - `VacancyNewPage`, `VacancyEditPage`
  - `LiveMonitorPage` (2 locations), `PortfolioPage` (2 locations)
  - `FitGapReportPage`, `TranscriptPage`
- **Sebelum:** 6+ pola berbeda (manual `<span>`, raw `/`, ArrowLeft icon)
- **Sesudah:** Satu component yang dipakai ulang di semua page

### P3.7 Standardize Error States

- **File:** Semua page dengan error states — sekarang pakai shared `Alert` component
- **Apa:** Semua error states distandardisasi ke `Alert` component dengan variants:
  - `Alert variant="danger"` — load errors, login errors, end session errors
  - `Alert variant="warning"` — portfolio generation failed (recoverable)
  - `Alert variant="info"` — reconnected prompt
- **Pages:** `PortfolioPage`, `FitGapReportPage`, `LiveMonitorPage`, `TranscriptPage`, `LoginPage`, `InterviewPage`, `VacancyListPage`, `AssessmentListPage`
- **Sebelum:** 5 pola berbeda (banner, card, text, inline, silent)
- **Sesudah:** Satu `Alert` component dengan semantic variants

### P3.8 404 Route

- **File:** `web/src/App.tsx`, `web/src/pages/NotFoundPage.tsx` (new)
- **Apa:** Catch-all route untuk path yang tidak dikenal
- **Sebelum:** Path salah render blank page
- **Sesudah:** "404 — Page not found" + link ke `/assessments`

### P3.9 Shared Alert Component

- **File:** `web/src/components/ui/alert.tsx` (new)
- **Apa:** Component reusable untuk banner notifikasi dengan 5 semantic variants:
  - `default` — neutral, untuk informasi umum
  - `success` — hijau, untuk operasi berhasil
  - `warning` — amber, untuk peringatan (rate limit, recoverable errors)
  - `danger` — merah, untuk error fatal
  - `info` — biru, untuk informasi tambahan
- **Sub-components:** `Alert`, `AlertIcon`, `AlertContent` — bisa dikombinasikan
- **Sebelum:** Setiap page build banner sendiri (inline styles, hardcoded colors)
- **Sesudah:** Satu component dengan design tokens yang konsisten

### P3.10 Shared Empty State Component

- **File:** `web/src/components/ui/empty-state.tsx` (new)
- **Apa:** Component reusable untuk menampilkan empty state (tidak ada data)
- **Props:** `icon`, `title`, `description`, `action` — semua optional
- **Default:** `FileX` icon + centered layout
- **Adopted di:** `VacancyListPage`, `AssessmentListPage`, `AssessmentInvitePage`
- **Sebelum:** Setiap page build empty state sendiri (hardcoded div + text)
- **Sesudah:** Satu component dengan layout yang konsisten

### P3.11 InterviewPage Polish

- **File:** `web/src/pages/interview/InterviewPage.tsx`
- **Apa:**
  - Emoji ✅ → `CheckCircle` Lucide icon (complete state)
  - Emoji ⚠️ → `AlertTriangle` Lucide icon (failed state)
  - Raw `<button>` → `<Button>` component (retry, refresh)
  - Hardcoded banners → `Alert` component (reconnecting, time warning, reconnected)
  - `bg-white` → `bg-background` (header + footer, dark mode fix)
- **Sebelum:** Emoji, raw HTML buttons, hardcoded colored banners
- **Sesudah:** Lucide icons, Button component, Alert component — consistent design system

### P3.12 bg-white Cleanup (Dark Mode Fix)

- **File:** `SkillCard.tsx`, `AssessorLayout.tsx`, `CandidateLayout.tsx`, `AssessmentInvitePage.tsx`, `InterviewPage.tsx`
- **Apa:** Ganti `bg-white` dengan `bg-background` atau `bg-card` di 5 lokasi
- **Sebelum:** `bg-white` hardcoded — dark mode broken (putih terang di dark theme)
- **Sesudah:** Menggunakan design tokens — dark mode berfungsi dengan benar
- **Catatan:** `HardwareCheck.tsx` tetap pakai `bg-white` karena itu decorative dot (bukan container bg)

### P3.13 Portfolio Rate Limit UX

- **File:** `web/src/pages/portfolio/PortfolioPage.tsx`
- **Apa:** Tampilkan `generation_error` dari API dengan pesan user-friendly:
  - Rate limit → "Busy right now — retrying automatically. Please wait a moment."
  - Timeout → "The request timed out. Please try again."
  - No content → "The AI did not return a result. Please try again."
  - Lainnya → tampilkan error asli
- **Helper:** `friendlyGenerationError(raw)` — translate pesan teknis ke bahasa user
- **Technical detail:** Ditampilkan kecil di bawah (untuk debugging, bisa dihide)
- **Sebelum:** "Portfolio generation failed." — hardcoded, tanpa penjelasan
- **Sesudah:** Pesan yang membantu user memahami situasi + tahu bahwa ini recoverable

### P3.14 Role Title Combobox (Data Consistency)

- **File:** `web/src/components/ui/combobox.tsx` (new), `web/src/components/ui/popover.tsx` (new)
- **File:** `web/src/pages/vacancies/VacancyNewPage.tsx`, `VacancyEditPage.tsx`, `AssessmentNewPage.tsx`, `AssessmentEditPage.tsx`
- **File:** `web/src/services/vacancies.ts` (add `roleTitles()` method)
- **Backend:** `api/app/controllers/api/v1/vacancies_controller.rb` (add `role_titles` action)
- **Backend:** `api/config/routes.rb` (add `get "vacancies/role_titles"` route)
- **Backend:** `api/app/models/vacancy.rb` (add `normalize_role_title` + uniqueness validation)
- **Backend:** `api/db/migrate/20260818000000_add_unique_index_on_vacancy_role_title.rb` (new)
- **Apa:**
  - Ganti free-text input role title → **Combobox** (searchable dropdown + custom input)
  - Fetch existing role titles dari API sebagai suggestions
  - User bisa pilih dari existing entries ATAU type baru
  - Backend normalize role title (strip + squeeze spaces) + unique constraint per tenant
  - DB unique index on `LOWER(TRIM(role_title))` prevents double entry
- **Dependencies:** `cmdk`, `@radix-ui/react-popover` (installed)
- **Sebelum:** Free-text input → "Senior FE" vs "Senior Frontend" = 2 record berbeda
- **Sesudah:** Combobox dengan suggestions → user pilih dari list, konsistensi terjaga

### P3.15 SkillPicker Duplicate Prevention

- **File:** `web/src/components/assessment/SkillPicker.tsx`
- **File:** Semua form pages (VacancyNew/Edit, AssessmentNew/Edit)
- **Backend:** `api/app/models/assessment_skill.rb`, `api/app/models/vacancy_skill.rb`
- **Apa:**
  - SkillPicker terima `selectedSkillIds` + `selectedSkillLabels` props
  - Skill yang sudah dipilih di-disable (grayed out + checkmark) di picker
  - Backend validasi: `skill_label` unik dalam 1 assessment/vacancy (case-insensitive)
  - Fix `skill_id: undefined` → `skill_id: s.skill_id` (preserve taxonomy linkage)
- **Sebelum:** User bisa klik skill yang sama berkali-kali → duplicate entries
- **Sesudah:** Skill yang sudah ada di-disable di picker + backend reject duplicate

### P3.16 Assessment List Page Revamp

- **File:** `web/src/pages/assessments/AssessmentListPage.tsx`
- **Apa:**
  - Colored card icons (40x40, rounded-lg) berdasarkan hash nama assessment — 5 warna (teal, blue, purple, amber, red)
  - Status badges dengan dot indicator (completed=teal, awaiting=amber, failed=red)
  - Filter pills (All, Completed, Awaiting, Failed) dengan count badge — stateful filter
  - Meta text: "X assessments" di bawah judul halaman
  - Skill count chip di setiap card
  - Deterministic icon selection berdasarkan assessment name (hash function)
- **Sebelum:** Plain cards dengan text status, tanpa colored icons, tanpa filter pills
- **Sesudah:** Cards dengan colored icon backgrounds, status badges, filter pills — sesuai design reference `rakamin-ui-revamp.html`

### P3.17 Assessment Detail Page Revamp

- **File:** `web/src/pages/assessments/AssessmentInvitePage.tsx`
- **Apa:**
  - Two-column layout (`grid-cols-[1fr_320px]`) menggantikan single column
  - Stats row: 3 stat cards (Total candidates, Completion rate, Skills assessed) — computed dari sessions data
  - Candidate table: avatar initials dengan colored background, name, submitted date, status badge, action button (Copy/Monitor/Report)
  - Sidebar: Assessment info card (Duration, Language, Skills, Created) + Skills breakdown card (progress bars)
  - Link banner: teal-50 background dengan Link2 icon + copy button — menggantikan Card-based invite link
  - Deterministic avatar colors berdasarkan candidate name (hash function)
- **Sebelum:** Single column `max-w-2xl`, basic session list dengan numbered circles, tanpa stats, tanpa sidebar
- **Sesudah:** Professional two-column layout `max-w-6xl` dengan stats row, candidate table, sidebar — sesuai design reference

### P3.18 Navbar Revamp

- **File:** `web/src/components/layout/AssessorLayout.tsx`
- **Apa:**
  - 4-square grid SVG logo (white squares on `#0F7B6C` background, rounded-lg) menggantikan `LayoutDashboard` Lucide icon
  - Active nav tab: `bg-teal-50 text-teal-700` (menggantikan `bg-primary/10 text-primary`)
  - Tenant pill: `bg-gray-100 border-gray-200 rounded-full` (menggantikan border-only style)
  - Logout button: plain style dengan hover effect (`hover:bg-gray-100`)
  - Page background: `bg-gray-50` (menggantikan `bg-background`) untuk visual depth
- **Sebelum:** `LayoutDashboard` icon, `bg-primary/10 text-primary` active state, border-only tenant pill, white background
- **Sesudah:** Branded 4-square logo, teal-50 active state, polished tenant pill — sesuai design reference

### P3.19 Form Pages Revamp

- **File:** `AssessmentNewPage.tsx`, `AssessmentEditPage.tsx`, `VacancyNewPage.tsx`, `VacancyEditPage.tsx`
- **Apa:**
  - Card wrapper: `bg-white border border-gray-200 rounded-xl p-7 max-w-[680px]` untuk semua form
  - Section titles: uppercase, letter-spacing (`text-[13px] font-semibold text-gray-500 uppercase tracking-wider`) — "ROLE DETAILS", "SKILLS", "ADDITIONAL DETAILS"
  - Form hints: `text-xs text-gray-500` di bawah inputs ("Used to generate AI interview questions...")
  - Skills widget: dashed empty state dengan Skills icon (`border-dashed border-gray-300`), populated rows dalam bordered container
  - Form actions: `border-t border-gray-200` divider, ghost cancel + primary save dengan arrow icon
  - Skill row layout: flex dengan skill name + level radio + remove button (inline, bukan card per skill)
- **Sebelum:** Plain forms tanpa card wrapper, tanpa section titles, basic skill widget dengan card per skill
- **Sesudah:** Card-based forms dengan section dividers, hints, polished skill widget — sesuai design reference

### P3.20 Vacancy List Page Revamp

- **File:** `web/src/pages/vacancies/VacancyListPage.tsx`
- **Apa:**
  - Colored card icons (40x40, rounded-lg) berdasarkan hash nama role — 5 warna (teal, blue, purple, amber, red)
  - Skill count chip di setiap card (`X skills`)
  - Meta text: "X vacancies" di bawah judul halaman
  - Card styling: `bg-white border border-gray-200 rounded-xl px-4 py-3.5` — konsisten dengan AssessmentListPage
  - Deterministic icon color selection berdasarkan role_title (hash function)
  - Hapus dependency `Card`/`CardContent` — menggunakan plain div dengan styling konsisten
- **Sebelum:** Plain cards dengan `Card`/`CardContent` component, Briefcase icon tanpa warna, tanpa skill count, tanpa meta text
- **Sesudah:** Cards dengan colored icon backgrounds, skill count chips, meta text — konsisten dengan AssessmentListPage

### P3.21 Assessment Filter — BE-Side + Role Title Search

- **File:** `api/app/controllers/api/v1/assessments_controller.rb`, `web/src/services/assessments.ts`, `web/src/pages/assessments/AssessmentListPage.tsx`
- **Backend:**
  - `filter_by_status(scope)` — LATERAL JOIN ke sessions terbaru, compute status via SQL:
    - `completed`: `latest.status = 'ended' AND latest.end_reason != 'error'`
    - `failed`: `latest.status = 'ended' AND latest.end_reason = 'error'`
    - `awaiting`: `latest.id IS NULL OR latest.status IN ('active','pending')`
  - `?role_title=Senior` → `WHERE name ILIKE '%Senior%'` (case-insensitive search)
  - Filter params dikombinasikan dengan pagination (Kaminari)
- **Frontend:**
  - Hapus `getAssessmentStatus()` — BE sudah compute status
  - Hapus `useMemo` untuk `assessmentsWithStatus`, `filtered`, `counts` — BE handle filtering
  - `useEffect` re-fetch saat filter atau role_title berubah
  - Role title search input dengan debounce 300ms
  - Filter pills sekarang trigger BE request, bukan client-side filter
- **Sebelum:** Filter client-side — semua assessment di-load, FE filter di browser
- **Sesudah:** Filter BE-side — hanya data yang relevan di-load, role_title search membantu user menemukan assessment yang dicari

### P3.22 Portfolio Results Page Revamp

**File:** `web/src/pages/portfolio/PortfolioPage.tsx`, `web/src/components/portfolio/SkillPortfolioCard.tsx`

**Design:** Two-column layout `grid-cols-[1fr_280px]` dengan `max-w-[1060px]`

- **Skill result cards:** Level badge 52x52 colored box (teal/amber/red), confidence dot + uppercase label, level scale 5 pips (teal filled, blue expected marker), override button
- **Evidence quotes:** `"` quote mark (serif) + italic text, sourced directly from transcript
- **Competency summary:** Separate section below evidence
- **Low confidence warning:** Amber left-border banner + AlertTriangle icon
- **Sidebar:** Overall score ring (SVG circle), skill summary with horizontal bars, session info table, Fit/Gap selector with "View Fit/Gap Report →" CTA
- **Action buttons:** Transcript, PDF, JSON in header
- **P3.25 Error states:** Amber warning banner with friendly error message + retry, "Analysis not ready yet" empty state with retry + view transcript
- **Generating state:** Centered spinner with "about 2 minutes" time estimate

**Rationale:** Assessor needs to see all skill results in one glance without excessive scrolling. The two-column layout keeps sidebar (score, summary, actions) always visible while reviewing skills.

### P3.23 Fit/Gap Report Page Revamp

**File:** `web/src/pages/fitgap/FitGapReportPage.tsx`, `web/src/components/fitgap/ComparisonTable.tsx`

**Design:** Two-column layout `grid-cols-[1fr_260px]` dengan `max-w-[1040px]`

- **Skill comparison:** Horizontal row per skill with Required chip, Candidate chip, ResultBadge (colored: teal/green match, red gap, blue exceed), GapChip ("−2 levels")
- **Table footer:** Summary counts: Match N skills, Gap N skills, Exceeds N skills
- **Culture & competency card:** Narrative text in bordered card
- **Discovered skills card:** Zap icon + amber label for skills not in vacancy
- **Sidebar:** Verdict card (score ring SVG + score% + badge + progress bar + summary rows), Recommendation card (dynamic text based on score), "← Back to portfolio" CTA
- **Action buttons:** Regenerate, PDF, JSON in header

**Rationale:** The fit/gap verdict (score + recommendation) is the primary decision-making element. Placing it in a persistent sidebar ensures the assessor always sees it while reviewing individual skill comparisons.

### P3.24 Transcript Page Revamp

**File:** `web/src/pages/transcript/TranscriptPage.tsx`

**Design:** `max-w-[740px]` centered, clean reading width

- **Left-border turns:** Each turn has a 1.5px left border — teal (`bg-teal-500`) for AI, blue (`bg-blue-400`) for candidate
- **Speaker labels:** Uppercase tracking-widest — `AI INTERVIEWER` (teal) / `CANDIDATE` (blue)
- **Content:** `text-sm text-gray-700 leading-relaxed whitespace-pre-wrap`
- **Error/empty states:** Centered friendly messages

**Rationale:** Transcripts are read linearly. The left-border approach provides immediate visual separation between speakers without the heaviness of full card backgrounds, reducing cognitive load during long reads.

### P3.25 Portfolio Error & Empty States

**File:** `web/src/pages/portfolio/PortfolioPage.tsx` (included in P3.22)

- **Error banner:** Amber background + `RefreshCw` icon + friendly message + retry button
- **Technical detail:** Shown only when `generation_error` is a meaningful string, with amber-600 text
- **Empty state:** 52x52 gray icon + "Analysis not ready yet" heading + description + two CTAs: "View transcript" + "Retry now"
- **Generating state:** Centered teal spinner + "Generating portfolio..." + "about 2 minutes" estimate

**Rationale:** Portfolio generation can fail (rate limits, timeouts). A friendly error state with retry prevents user frustration. The empty state keeps the user informed while waiting for generation to complete.

---

## 3. ALASAN & DAMPAK

### 3.1 Mengapa Custom Font Penting

**Alasan:** Typography adalah salah satu elemen visual paling berpengaruh dalam UI. Browser default font (Times New Roman, system-ui) memberikan kesan "template" dan tidak profesional. Inter adalah font yang dipakai oleh Vercel, Linear, GitHub — platform yang terkenal dengan design quality.

**Dampak:**
- **Visual:** Aplikasi langsung terasa lebih modern dan profesional
- **Readability:** Inter dirancang khusus untuk screen, excellent di semua size
- **Brand consistency:** Font yang sama di semua halaman, tidak tergantung browser/OS user
- **Monozukuri:** Menunjukkan perhatian terhadap detail visual

### 3.2 Mengapa Login Page Perlu Makeover

**Alasan:** Login page adalah **halaman pertama** yang dilihat user. Kesan pertama menentukan persepsi terhadap seluruh aplikasi. Plain white tanpa branding = terkesan unfinished.

**Dampak:**
- **First impression:** User langsung merasa aplikasi ini "serius" dan "ready"
- **Branding:** Icon BrainCircuit + "AI Interview" = identity yang clear
- **Trust:** Card dengan shadow = depth = terkesan solid, bukan prototype
- **UX:** Gradient background = tidak plain, ada visual interest

### 3.3 Mengapa Heading Perlu Distandardisasi

**Alasan:** Inconsistent typography = tidak profesional. User beralih dari halaman ke halaman, heading size berubah-ubah = tidak predictabel.

**Dampak:**
- **Visual hierarchy:** Konsisten = user tahu apa yang penting
- **Professionalism:** Detail kecil yang menunjukkan craftsmanship
- **Maintainability:** Satu standar = mudah diubah nanti

### 3.4 Mengapa Breadcrumb Perlu Dibuat Shared Component

**Alasan:** 6+ pola berbeda untuk navigasi = code duplication + inconsistency. Setiap page build breadcrumb sendiri = waste time + bugs.

**Dampak:**
- **Code quality:** DRY principle, satu component dipakai ulang
- **Consistency:** User tahu cara navigasi karena pola yang sama
- **Maintainability:** Ubah sekali, berubah di semua page

### 3.5 Mengapa Error States Perlu Distandardisasi

**Alasan:** Error adalah momen krusial — user bingung, butuh bantuan. Kalau pola error berbeda-beda di setiap page = user tidak tahu harus apa.

**Dampak:**
- **UX:** User tahu cara recovery (tombol "Back" selalu ada)
- **Trust:** Error yang ditangani dengan baik = lebih trustworthy daripada blank page
- **Debugging:** Developer tahu harus melihat mana saat ada bug

### 3.6 Mengapa 404 Route Penting

**Alasan:** Tanpa catch-all route, path salah = blank page. User tidak tahu apa yang terjadi = frustration.

**Dampak:**
- **UX:** User tahu bahwa page tidak ada, bukan aplikasi error
- **Professionalism:** Detail kecil yang menunjukkan completeness
- **SEO/Accessibility:** Proper HTTP status handling

### 3.7 Mengapa Alert Component Penting

**Alasan:** Banner notifikasi (error, warning, info) dibutuhkan di banyak tempat. Tanpa shared component, setiap page build sendiri = inconsistent styling + code duplication.

**Dampak:**
- **Consistency:** Semua notifikasi terlihat sama, user tahu cara membacanya
- **Semantic meaning:** Variant (`danger`, `warning`, `info`) memberikan konteks visual
- **Maintainability:** Ubah sekali, berubah di semua page
- **Accessibility:** Role `alert` sudah built-in

### 3.8 Mengapa Empty State Component Penting

**Alasan:** Halaman tanpa data (list kosong) adalah momen yang sering diabaikan. Tanpa shared component, empty state dibangun berbeda-beda = inconsistent.

**Dampak:**
- **UX:** User tahu bahwa memang belum ada data (bukan error)
- **Onboarding:** Action button ("Create your first...") membantu user memulai
- **Visual consistency:** Semua empty state terlihat sama

### 3.9 Mengapa Portfolio Error Perlu Di-friendly-kan

**Alasan:** "Portfolio generation failed." adalah pesan yang menakutkan dan tidak membantu. User tidak tahu apakah ini error permanent, apakah bisa dicoba lagi, atau apakah ini masalah sementara (rate limit).

**Dampak:**
- **Trust:** User tahu bahwa ini situasi sementara, bukan aplikasi broken
- **Actionable:** User tahu harus apa (tunggu, coba lagi, atau hubungi admin)
- **Reduced support:** User tidak panic dan menghubungi support untuk hal yang sebenarnya recoverable

### 3.10 Mengapa Role Title Perlu Combobox

**Alasan:** Free-text input untuk role title menyebabkan inkonsistensi data. "Senior Frontend Engineer", "Senior FE", "senior frontend engineer" — semua dianggap berbeda. Tanpa normalisasi, data menjadi kotor dan sulit di-analyze.

**Dampak:**
- **Data quality:** Combobox dengan suggestions memaksa user memilih dari entry yang sudah ada
- **Normalization:** Backend trim + squeeze whitespace mengurangi variasi yang tidak perlu
- **Uniqueness:** DB unique index mencegah duplicate entries secara physical
- **UX:** User tidak perlu type ulang — cukup pilih dari dropdown

### 3.11 Mengapa SkillPicker Perlu Duplicate Prevention

**Alasan:** Tanpa guard, user bisa menambahkan skill yang sama berkali-kali. Ini menghasilkan data yang redundant dan membingungkan saat review portfolio.

**Dampak:**
- **Data integrity:** Backend validation menolak duplicate skill_label dalam 1 assessment/vacancy
- **UX:** Skill yang sudah dipilih di-disable di picker — user langsung tahu mana yang sudah ada
- **Taxonomy linkage:** Fix `skill_id: undefined` → `skill_id: s.skill_id` memastikan referensi ke master data terjaga

### 3.12 Mengapa Assessment List Perlu Colored Icons & Filter

**Alasan:** List assessment yang monoton (semua card terlihat sama) membuat user sulit membedakan status sekilas. Tanpa filter, user harus scroll untuk menemukan assessment yang dicari.

**Dampak:**
- **Visual scanning:** Colored icons membedakan status dalam < 100ms (green=done, amber=waiting, red=failed)
- **Efficiency:** Filter pills memungkinkan user fokus pada status tertentu tanpa scroll
- **Professionalism:** Desain yang polished menunjukkan craftsmanship (Monozukuri)

### 3.13 Mengapa Assessment Detail Perlu Two-Column Layout

**Alasan:** Detail assessment adalah halaman yang paling sering diakses assessor. Single column layout membuat informasi terlalu vertikal — user harus scroll untuk melihat semua data.

**Dampak:**
- **Information density:** Stats + candidates + sidebar visible dalam satu viewport
- **Context:** Sidebar memberikan assessment info tanpa navigasi ke tempat lain
- **Workflow:** Candidate table dengan action buttons mempercepat daily workflow assessor

### 3.14 Mengapa Navbar Perlu Branded Logo

**Alasan:** Logo adalah elemen branding paling prominent. `LayoutDashboard` adalah generic icon yang tidak memberikan identity. 4-square grid adalah brand mark yang unik.

**Dampak:**
- **Brand recognition:** User langsung mengenali aplikasi dari logo
- **Professionalism:** Branded logo menunjukkan investment dalam product
- **Consistency:** Logo yang sama di semua halaman memperkuat identity

### 3.16 Mengapa Vacancy List Perlu Colored Icons & Skill Count

**Alasan:** Vacancy list page dan assessment list page harus terlihat konsisten karena keduanya adalah halaman utama yang dilihat assessor. Tanpa colored icons, vacancy cards terlihat plain dan sulit dibedakan sekilas. Skill count memberikan quick overview tanpa perlu buka detail.

**Dampak:**
- **Visual consistency:** Kedua list page (assessments + vacancies) sekarang memiliki pola yang sama — colored icons, rounded cards, meta info
- **Visual scanning:** Colored icons membedakan vacancy dalam < 100ms
- **Quick overview:** Skill count chip memberikan info tanpa navigasi ke detail
- **Professionalism:** Konsistensi antar halaman menunjukkan craftsmanship (Monozukuri)

### 3.17 Mengapa Filter Perlu Dipindah ke BE

**Alasan:** Client-side filter memaksa FE load semua data sebelum bisa filter. Ini tidak scalable — kalau ada 1000 assessments, semuanya di-load ke browser dulu. BE-side filter lebih efisien karena hanya data yang relevan yang di-transfer. Selain itu, role title search membantu user menemukan assessment spesifik tanpa scroll.

**Dampak:**
- **Performance:** Hanya data yang relevan yang di-load (transfer lebih kecil)
- **Scalability:** Filter tetap cepat meskipun data banyak
- **UX:** Role title search membantu user menemukan assessment yang dicari
- **Best practice:** BE handle data logic, FE handle display — separation of concerns

### 3.15 Mengapa Form Perlu Card Wrapper & Section Titles

**Alasan:** Forms tanpa visual container terlihat "raw" dan tidak terstruktur. Section titles membantu user memahami flow form (apa yang harus diisi dulu).

**Dampak:**
- **Visual structure:** Card wrapper memberikan boundary yang jelas antara form dan background
- **Cognitive load:** Section titles memecah form menjadi chunks yang manageable
- **Polish:** Detail kecil (hints, dividers, arrow icons) menunjukkan perhatian terhadap UX

---

## 4. MANFAAT UNTUK PENGGUNA

### Untuk Assessor/Hiring Manager
- **Login page yang menarik** → kesan pertama positif
- **Font yang mudah dibaca** → nyaman membaca portfolio, transcript, fit-gap report
- **Breadcrumb yang konsisten** → mudah navigasi antar page
- **Error states yang jelas** → tahu harus apa saat ada error
- **Portfolio error yang friendly** → tidak panic saat rate limit, tahu ini recoverable
- **Role title combobox** → pilih dari existing entries, tidak perlu type ulang
- **Skill duplicate prevention** → tidak ada skill ganda yang membingungkan
- **Assessment list dengan colored icons** → identifikasi status sekilas tanpa baca text
- **Filter pills** → fokus pada status tertentu tanpa scroll
- **Role title search** → cari assessment spesifik tanpa scroll
- **Assessment detail two-column** → stats + candidates + sidebar dalam satu viewport
- **Candidate table dengan avatars** → identifikasi candidate lebih personal
- **Vacancy list dengan colored icons** → identifikasi vacancy sekilas, konsisten dengan assessment list
- **Vacancy skill count chip** → tahu jumlah skills tanpa buka detail
- **Branded navbar logo** → aplikasi terasa "serius" dan "ready"
- **Form card wrapper** → form terstruktur dan mudah diikuti
- **Portfolio two-column layout** → skill cards + sidebar sejajar, tidak perlu scroll
- **Skill result card dengan level scale** → visualisasi level kandidat vs expected
- **Evidence quotes** → quote asli dari transcript, bukan abstraksi AI
- **Fit/Gap verdict sidebar** → skor fit + badge + rekomendasi dalam satu glance
- **Transcript left-border turns** → identifikasi speaker tanpa baca label
- **Transcript max-width 740px** → reading width yang nyaman
- **Fit/Gap error states yang friendly** → banner + retry, bukan blank screen

### Untuk Candidate
- **Interview page yang polished** → merasa dihargai, bukan "cuma test"
- **Loading states yang baik** → tidak bingung saat menunggu
- **Error handling yang jelas** → tahu kalau ada masalah, bukan blank screen
- **Connection lost handling** → tahu cara retry, bukan stuck

### Untuk Developer (Maintainability)
- **Shared components** → kurang code duplication (Alert, Breadcrumb, EmptyState, Combobox)
- **Consistent patterns** → mudah add page baru
- **Design tokens** → mudah ubah warna/font nanti
- **Semantic variants** → error handling lebih expressif
- **Data integrity** → backend validation + DB index mencegah data kotor

---

*Dibuat: 17 Agu 2026. Diperbarui: 18 Agu 2026 (UI Revamp: P3.16–P3.25).*
