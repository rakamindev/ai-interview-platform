# Take-Home Engineering Notes (`brief-fullstack`)

## Stage 0: Brief Inspection & Planning
- **Work Completed:**
  - Inspected root documentation (`README.md`, `api/README.md`, `web/README.md`), fullstack assignment brief PDF, and repository product specifications (`PRD 01 — First Principles: AI Interview Behavior` and `PRD 02 — Real Simulation: End-to-End Interview`).
  - Summarized mandatory requirements, submission artifacts, disqualifiers, stage-by-stage 10–12h time budget, and brief/repo discrepancies.

---

## Stage 1: Local Setup and Baseline Exploration

### 1. Stage & Work Completed
- Verified git repository cleanliness on `main` (`b836d02`) and created feature branch `feature/case-study-fullstack-irfan-aprilyana`.
- Inspected dependency manifests (`api/Gemfile`, `api/Gemfile.lock`, `web/package.json`), environment samples (`api/config/application.yml.sample`, `web/.env.example`), database migrations and schema (`api/db/migrate/`, `api/db/schema.rb`, `api/db/seeds.rb`), and initializers (`eventmachine.rb`, `gemini.rb`, `sidekiq.rb`, `websocket.rb`, `puma.rb`).
- Installed frontend packages (`npm install` in `web/`) and verified TypeScript compilation + Vite production build (`npm run build`).
- Started existing local Laragon PostgreSQL 11.0 service (`localhost:5432`) and installed/started Redis 8.10.2 (`localhost:6379`) and Ruby 3.3.2 (`C:\Ruby332-x64` with MSYS2 DevKit).
- Configured local environment files (`api/config/application.yml` and `web/.env`) with secrets redacted and gitignored.
- Executed end-to-end synthetic API verification across `Assessment` → `Session` → `CandidateInfo` → `Vacancy` → `Portfolio` → `AssessorOverride` → `FitGapReport`.

### 2. Verified Observations & Supporting Evidence
1. **Documentation vs. Repository File Discrepancies:**
   - `README.md` and `web/README.md` instruct running `cp .env.sample .env`, but the actual template in `web/` is `.env.example`.
   - `web/.env.example` configures `VITE_API_BASE_URL=http://localhost:3000/api/v1` and `VITE_WS_BASE_URL=ws://localhost:3000` (port `3000`), whereas `api/config/puma.rb` binds to port `3001` (`ENV.fetch('PORT', 3001)`).
   - `api/config/application.yml.sample` sets `APP_BASE_URL: "http://localhost:3001"`, which causes `Session#invite_url` (`api/app/models/session.rb:31`) to generate candidate invite links pointing to the Rails API port (`3001`) rather than the Vite frontend (`5173`).
   - `api/README.md` documents `GEMINI_ANALYSIS_MODEL`, whereas `api/config/application.yml.sample`, `api/config/initializers/gemini.rb`, `Coverage::Analyzer`, and `FitGap::Engine` read `GEMINI_FLASH_MODEL`.
2. **Exact Ruby Patch Pin & Platform Lock in `api/`:**
   - `api/Gemfile` specifies `ruby '3.3.2'` and omits `tzinfo-data` on Windows. Linking MSYS2 `/usr/share/zoneinfo` resolved `TZInfo::DataSourceNotFound` without altering `Gemfile` in Stage 1.
   - `api/config/puma.rb` evaluates `ENV.fetch('WEB_CONCURRENCY', 2)` before Figaro loads `application.yml`; passing `WEB_CONCURRENCY=0` in the shell environment boots Puma in single mode on Windows.
3. **Missing Test Harnesses at Baseline:**
   - `api/` includes `.rspec` (`--require spec_helper`) and `rspec-rails` in `Gemfile`, but has **no `spec/` directory**.
   - `web/package.json` defines `dev`, `build`, and `preview` scripts, with **no test runner** installed.

### 3. Commands Executed & Actual Outcomes
- `git checkout main && git checkout -b feature/case-study-fullstack-irfan-aprilyana` → Switched to new branch off `main` (`b836d02`).
- `cd web && npm install` → Installed 188 packages (`0 vulnerabilities`), exited `0`.
- `cd web && npm run build` (`tsc && vite build`) → Passed cleanly (`✓ 1711 modules transformed`, built in `8.99s`), exited `0`.
- `cd web && npm run dev -- --host 127.0.0.1 --port 5173` → Vite dev server listening on `http://127.0.0.1:5173/`, verified `HTTP 200 OK`.
- `postgres.exe -D "C:\laragon\data\postgresql-11"` → PostgreSQL 11.0 started on `localhost:5432` (copied `zlib1.dll` into PostgreSQL `bin/` so `pgcrypto.dll` loads cleanly).
- `redis-server.exe` & `redis-cli.exe ping` → Redis 8.10.2 started on `localhost:6379`, returned `PONG`.
- `cd api && bundle install` → `Bundle complete! 30 Gemfile dependencies, 125 gems now installed`, exited `0`.
- `cd api && bundle exec rspec` → Exited `1` (`LoadError: cannot load such file -- spec_helper`; `0 examples, 0 failures, 1 error occurred outside of examples`).
- `cd api && bundle exec rubocop --format simple` → Exited `1` (`85 files inspected, 1384 offenses detected, 1045 offenses autocorrectable`).
- `cd api && bundle exec rails db:create db:migrate db:seed` → Exited `0`: migrated all 8 migrations (`20231201000000` through `20260505000002`), created organization `id=1 (test-corp)`, and seeded 22 B7 skills.
- `curl.exe -s http://127.0.0.1:3001/health` → `{"status":"ok"}` (`200 OK`).
- `curl.exe -s -H "Authorization: Bearer <redacted>" http://127.0.0.1:3001/api/v1/skill_taxonomies` → `22` records (`200 OK`).

---

## Stage 2: Product and Domain Understanding

### 1. Product Purpose Statement
Rakamin AI Interview Platform enables assessors, recruiters, and hiring managers to conduct adaptive, evidence-backed voice interviews (powered by Gemini Live) against behavioral L1–L5 skill anchors, producing a portable **Skill Portfolio** (with verbatim transcript evidence and human override capability) and role-specific **Fit/Gap Reports** so hiring teams can make defensible, bias-reduced shortlisting and role-matching decisions without forcing candidates through repetitive first-round screening interviews.

### 2. Five Pillars Analysis
1. **Product (What users can accomplish today):**
   - **Assessors** can create/edit Assessments (`10/30/45/60/90` min, English or Bahasa Indonesia, 1–8 skills from the 22 B7 taxonomy skills or custom L1–L5 anchors), generate candidate invite links (`Session`), monitor live interviews via WebSocket (`LiveMonitorPage` showing `CoverageMap` states `not_yet → initiated → partial → covered` and rolling transcript), review completed `Portfolio` cards (`ai_level`, `ai_confidence`, verbatim `evidence` quotes, `competency_summary`), apply human `AssessorOverride` ratings (`override_level` + optional `assessor_notes`), create `Vacancy` role requirements, generate `FitGapReport` comparisons (`match`, `exceed`, `gap`, `not_assessed` + narratives), and export PDF/JSON reports.
   - **Candidates** can open a token-authenticated link (`/interview/:token`), run hardware/network checks (`HardwareCheck.tsx`: mic, speakers, ping/upload speed test), complete a real-time bidirectional voice interview with transcript visibility (`InterviewPage.tsx`), and end the session manually or automatically when all skills are covered or time expires.
2. **Industry (Indonesian Hiring & Assessment Constraints):**
   - High-volume screening in Indonesia faces acute assessor bandwidth bottlenecks, inconsistent interviewer calibration across L1–L5 seniority levels, bilingual switching (Bahasa Indonesia mixed with English technical terminology), and uneven candidate network/device quality across regions.
   - Regulatory context under **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)** establishes rights over automated profiling (`Pasal 10`) and controller obligations for data accuracy, completeness, and consistency (`Pasal 29`).
3. **Purpose (Decision / Outcome Improved):**
   - Decouples **skill measurement** (the candidate's reusable L1–L5 Skill Portfolio) from **role evaluation** (the Vacancy Fit/Gap comparison), ensuring every hiring recommendation is traceable to verbatim candidate quotes and subject to meaningful human assessor review (`AssessorOverride`).
4. **Direct Users (Assessors, Recruiters, Hiring Managers):**
   - Need to quickly distinguish whether a low score or a "gap" is due to weak candidate capability, low probing depth (`ai_confidence: 'low'`), or an interrupted/incomplete interview (`not_yet` coverage), and need their human overrides (`AssessorOverride`) and rationale (`assessor_notes`) to propagate accurately into Fit/Gap reports and exports.
5. **Affected People (Candidates):**
   - Candidates invest 10–90 minutes of spoken behavioral evidence. If an interview ends early (network drop, time ceiling, or manual stop) or AI misinterprets a bilingual/concise answer, conflating "unassessed" with "low skill (L1)" or hiding human override context directly harms fair candidate evaluation.

### 3. Verified End-to-End Workflow & Failure Modes (Synthetic Run)
- **Step 1: Assessment & Vacancy Configuration (`POST /api/v1/assessments`, `POST /api/v1/vacancies`)**
  - *Verified output:* Created Assessment `id=1` (`Senior Backend Engineer (Synthetic)`, 3 skills: `SK-ENG-002` L3, `SK-ENG-003` L4, `SK-ENG-004` L3) and Vacancy `id=1` (`Principal Backend Engineer (Synthetic)`).
  - *Failure mode:* `SystemPromptGeneratorWorker` runs asynchronously without UI status feedback on `AssessmentListPage` or `AssessmentInvitePage`; if prompt compilation fails, `assessment.system_prompt` remains `nil` until fallback compilation at session start.
- **Step 2: Candidate Invitation & Pre-Interview Check (`POST /api/v1/assessments/1/sessions`, `GET /api/v1/sessions/:token/candidate`)**
  - *Verified output:* Created Session `id=1` (`status: "pending"`, `invite_url` generated).
  - *Failure mode:* `candidate_info` does not return `candidate_name` or assessment language (`id`/`en`) or skill count, and default `APP_BASE_URL` in `.sample` points to port `3001` instead of `5173`.
- **Step 3: Live Interview & Coverage Tracking (`Sessions::StartHandler`, `Coverage::Analyzer`, `Sessions::EndHandler`)**
  - *Verified output:* `StartHandler` initializes `coverage_maps` with `state: 'not_yet', probe_count: 0`.
  - *Failure mode:* If a session ends early (`manual_candidate`, `manual_assessor`, `time_ceiling`, or `error`), some skills remain `state: 'not_yet', probe_count: 0`.
- **Step 4: Portfolio Generation (`Portfolios::Generator#call`, `GET /api/v1/sessions/1/portfolio`)**
  - *Verified output & defect:*
    1. `Portfolios::Generator#build_prompt` (`api/app/services/portfolios/generator.rb:81-101`) instructs Gemini to assign a level (`1..5`) to **each** skill in the coverage map—even skills with `state: 'not_yet'` (`probe_count: 0`). Because `skill_data['level'].to_i.clamp(1, 5)` forces a minimum of `1`, an unprobed skill either gets fabricated as `L1 (low confidence)` (penalizing the candidate as `gap` instead of `not_assessed`!) or, if omitted by the LLM, **vanishes completely** from `PortfolioPage.tsx` so the assessor cannot see which configured skills went unassessed!
    2. `PortfolioPage.tsx` does not display session metadata (`end_reason`, `duration_seconds`, or coverage completeness), nor does it display `generation_error` when `generation_status === "failed"`.
    3. `PortfoliosController#portfolio_json` (`api/app/controllers/api/v1/portfolios_controller.rb:170`) does not order `portfolio.portfolio_skills`, causing skill cards to jump order after overrides or reloads.
- **Step 5: Human Assessor Override (`POST /api/v1/portfolio_skills/:id/override`, `OverridePanel.tsx`)**
  - *Verified output & defect:*
    1. `OverridePanel.tsx` (`web/src/components/portfolio/OverridePanel.tsx:81`) treats `assessor_notes` as optional and allows submitting an override with the exact same level as `ai_level` or blank rationale.
    2. `SkillPortfolioCard.tsx` (`web/src/components/portfolio/SkillPortfolioCard.tsx:25-78`) **never renders `override.assessor_notes`** on the card after an override is saved!
- **Step 6: Fit/Gap Report & Export (`FitGap::Engine#call`, `FitGapReportPage.tsx`, `ComparisonTable.tsx`)**
  - *Verified output & defect (confirmed via `GET /api/v1/portfolios/1/fitgap/1`):*
    1. **Broken "Required" Column (`api/` ↔ `web/` contract bug):** `FitGap::Engine#build_skill_comparisons` (`api/app/services/fit_gap/engine.rb:58-66`) outputs `"expected_level": 3`, whereas `ComparisonTable.tsx` (`web/src/components/fitgap/ComparisonTable.tsx:50`) reads `LEVEL_LABELS[c.required_level]`, rendering **blank** in the "Required" column for every row!
    2. **Broken Human Override Indicator (`✏`):** `FitGap::Engine#build_skill_comparisons` omits `is_override` (even though `effective_portfolio_skills` computes `overridden: override.present?`), so `c.is_override` in `ComparisonTable.tsx:56` is always `undefined` and the `✏` badge never renders.
    3. **Masked Overall Hiring Recommendation:** `FitGapReportPage.tsx:173` renders `{report.culture_narrative || report.overall_narrative}` inside a single card, hiding `overall_narrative` whenever `culture_narrative` is present.
    4. **Unassessed Skills Omitted from Summary:** `ComparisonTable.tsx:29-31,72-77` and `FitGap::Engine#generate_fallback_narrative` only count `match`, `gap`, and `exceed`, silently omitting `not_assessed` counts.
    5. **Infinite Trigger Loop on Fit/Gap Failure:** If `FitGapGeneratorWorker` fails, no `FitGapReport` row exists; `FitGapReportPage.tsx:35-42` receives `404` on every 5s poll and re-POSTs `triggerFitGap` indefinitely.

### 4. Data-Protection Considerations (UU No. 27 Tahun 2022 / UU PDP)
- **Official Source Citations (Accessed 2026-10-18):**
  - Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (JDIH BPK RI: `https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022`).
  - **Pasal 10 ayat (1):** *"Subjek Data Pribadi berhak untuk mengajukan keberatan atas tindakan pengambilan keputusan yang hanya didasarkan pada pemrosesan secara otomatis, termasuk pemprofilan, yang menimbulkan akibat hukum atau berdampak signifikan pada Subjek Data Pribadi."* → Reinforces why `AssessorOverride` (meaningful human review with visible rationale and propagation to Fit/Gap reports) and clear separation of verbatim evidence from AI interpretation are essential product safeguards.
  - **Pasal 29 ayat (1) & (2):** *"Pengendali Data Pribadi wajib memastikan akurasi, kelengkapan, dan konsistensi Data Pribadi... wajib melakukan verifikasi."* → Reinforces why unprobed skills (`state: 'not_yet'`) must never be fabricated into `L1` low scores and why data contract mismatches between `Portfolio`, `AssessorOverride`, `FitGapReport`, and `Exports::PdfGenerator` must be eliminated.
  - **Pasal 5:** Right of the data subject to transparency regarding the purpose of data collection and accountability of processing before the interview starts.
  - *(Disclaimer per Working Rule 15: These observations inform product engineering design only and do not constitute a legal compliance certification.)*

### 5. Potential Improvement Hypotheses (For Stage 3 Evaluation)
- **Hypothesis H1 (End-to-End Evaluation Integrity: Portfolio ↔ Unassessed Coverage ↔ Assessor Override ↔ Fit/Gap Contract & Transparency):**
  - *Hypothesis:* If we reconcile the broken data contracts and evaluation seams across `Portfolios::Generator`, `PortfoliosController`, `PortfolioSkillsController`, `FitGap::Engine`, `PortfolioPage`, and `FitGapReportPage`—specifically: (a) preserving `not_yet` / unassessed skills distinctly from assessed skills instead of fabricating `L1` or dropping them silently, (b) enforcing & displaying human `AssessorOverride` rationale (`assessor_notes`) and propagating `is_override`, `ai_level`, and `required_level`/`expected_level` into `FitGap::Engine` and `ComparisonTable`, (c) rendering both `culture_narrative` and `overall_narrative` plus an explicitFit/Gap readiness/coverage summary, and (d) surfacing session end reason & generation error states—then assessors can make accurate, auditable, human-in-the-loop hiring decisions without misclassifying incomplete interviews as candidate skill gaps.
- **Hypothesis H2 (Candidate Pre-Interview Transparency, Consent & Session Readiness Guardrails):**
  - *Hypothesis:* If we enhance the candidate entry flow (`candidate_info` + `InterviewPage`) with clear assessment scope/language/privacy notice and pre-interview readiness state, candidates will understand how their voice/transcript data is processed before recording begins.


---

## Stage 3: Problem Discovery and Gap Analysis

### 1. Severity Scale Definition
- **P0 (Critical / Blocker):** Cross-tenant data exposure/tampering (IDOR) or broken core data contracts that render primary decision-making data blank/corrupted in the UI.
- **P1 (High):** Flawed business logic or missing UI/API propagation that distorts candidate evaluation outcomes (e.g. conflating unassessed skills with `L1` gaps, hiding human override rationale or overall hiring recommendations).
- **P2 (Medium):** Degraded failure-path UX or background worker polling bugs (e.g. infinite re-trigger loop on `404`, hidden `generation_error` details).
- **P3 (Low):** Developer experience, configuration defaults, or minor visual/ordering polish.

### 2. Verified Findings Summary
- **F-01 (P0) — Cross-Tenant Authorization Bypass (IDOR) on Portfolio Export, Fit/Gap, and Assessor Override Endpoints:**
  - *Verified via live API test:* Tenant 2 (`scheme: 'other-corp'`) received `200 OK` on `GET /api/v1/portfolios/1/export?format=json`, `200 OK` on `GET /api/v1/portfolios/1/fitgap/1`, and `201 Created` on `POST /api/v1/portfolio_skills/1/override` for Tenant 1's candidate portfolio because `Portfolio` and `PortfolioSkill` queries in `PortfoliosController` and `PortfolioSkillsController` do not join `:session` (which carries `TenantScoped`).
- **F-02 (P0) — Broken Data Contract in Fit/Gap Skill Comparisons (`expected_level` vs `required_level` & Missing `is_override`):**
  - *Verified via live API test (`GET /api/v1/portfolios/1/fitgap/1`):* `FitGap::Engine#build_skill_comparisons` outputs `expected_level` and omits `required_level`, `is_override`, `ai_level`, and `assessor_notes`. `ComparisonTable.tsx` reads `c.required_level` (rendering blank in the "Required" column for all rows) and `c.is_override` (never rendering the `✏` override badge).
- **F-03 (P1) — Unassessed (`not_yet`) Skills Are Either Fabricated as `L1` by `Portfolios::Generator` or Silently Dropped from `PortfolioPage`:**
  - *Verified via code & synthetic run:* `Portfolios::Generator#build_prompt` asks Gemini to score every skill in `coverage_maps` (even `state: 'not_yet', probe_count: 0`) and clamps levels with `.to_i.clamp(1, 5)`, turning unassessed skills into `L1` (`gap` in Fit/Gap instead of `not_assessed`), or dropping them from `PortfolioPage.tsx` with no visibility into session `end_reason`, `duration_seconds`, or unassessed skills.
- **F-04 (P1) — Assessor Override Rationale (`assessor_notes`) Hidden on `SkillPortfolioCard`, Unvalidated in `OverridePanel`/API, and Unordered `portfolio_skills`:**
  - *Verified via live API test & code inspection:* `SkillPortfolioCard.tsx` never renders `override.assessor_notes`; `OverridePanel.tsx` and `AssessorOverride` allow saving overrides with blank notes or unchanged levels (`override_level == ai_level`); `PortfoliosController#portfolio_json` does not order `portfolio_skills`, causing cards to jump order after updates.
- **F-05 (P1) — `FitGapReportPage` Masks `overall_narrative` Behind `culture_narrative` and Omits `not_assessed` Counts:**
  - *Verified via code & live API test:* `FitGapReportPage.tsx:173` renders `{report.culture_narrative || report.overall_narrative}` in a single card (hiding the overall hiring recommendation when `culture_narrative` is present), while `ComparisonTable.tsx` and `FitGap::Engine#generate_fallback_narrative` omit `not_assessed` counts.
- **F-06 (P2) — Infinite Trigger Loop on `FitGapReportPage` Poll `404` & Hidden `generation_error` on `PortfolioPage`:**
  - *Verified via code inspection:* `FitGapReportPage.tsx:35-42` calls `triggerFitGap` on every 5s poll `404` response; `PortfolioPage.tsx:170-184` ignores `portfolio.generation_error`.
- **F-07 (P3) — Environment & Config Defaults (`web/.env.example` port `3000`, `APP_BASE_URL` port `3001`, Windows `puma.rb` workers):**
  - *Verified during Stage 1 setup.*

### 3. Recommended Fullstack Scope (4–5 Hours) — Declared Depth: **FRONTEND-HEAVY**
- **Declared Engineering Depth:** **`FRONTEND-HEAVY`** (fixed direction across all stages, implementation, testing, PR description, and final report).
- **Selected Scope:** **End-to-End Post-Interview Evaluation & Decision Integrity (`PortfolioPage` ↔ `SkillPortfolioCard` / `OverridePanel` ↔ `FitGapReportPage` / `ComparisonTable`, backed by `PortfoliosController`, `PortfolioSkillsController`, `Portfolios::Generator`, and `FitGap::Engine` — addressing F-01 through F-06).**
- **Why This Problem Fits `FRONTEND-HEAVY` Depth:**
  - The post-interview evaluation surfaces (`PortfolioPage.tsx`, `SkillPortfolioCard.tsx`, `OverridePanel.tsx`, `FitGapReportPage.tsx`, `ComparisonTable.tsx`) are where assessors, recruiters, and hiring managers synthesize complex, multi-state assessment data (`pending`, `generating`, `complete`, `failed`, partial session coverage with `not_yet` skills, `low/medium/high` AI confidence, human overrides, and role Fit/Gap deltas).
  - **Frontend Engineering Depth Focus (~65% effort):**
    1. **Information Architecture & Assessment-Result Presentation:** Session completeness banner (`end_reason`, duration, covered vs. unassessed skill counts), dedicated **Unassessed Skills** section (`not_yet` skills distinguished from `L1` ratings), visible human override rationale (`assessor_notes`, `AI Lx → Override Ly`, timestamp) on `SkillPortfolioCard`, and separated **Overall Hiring Recommendation** vs. **Culture & Competency Fit** cards plus complete Fit/Gap summary metrics (`Match`, `Exceeds`, `Gap`, `Not Assessed`) on `FitGapReportPage` / `ComparisonTable`.
    2. **Component Design & Strict TypeScript Contracts:** Reconciled TypeScript interfaces (`Portfolio`, `SessionSummary`, `UnassessedSkill`, `SkillComparison`, `FitGapReport`), clean component boundaries, and interactive filtering/inspection of skills.
    3. **Asynchronous State Machine & Failure-Path Handling:** Deterministic state transitions across `loading`, `generating` (polling), `partial` (early-ended sessions), `failed` (displaying backend `generation_error` with retry feedback), `empty`, and `complete` states—eliminating the infinite `404` re-trigger loop on `FitGapReportPage`.
    4. **Validation, Accessibility (a11y) & Responsive / Long-Text UX:** Client-side + server-synced validation in `OverridePanel` (requiring meaningful `assessor_notes` and preventing no-op saves unless updating notes), keyboard navigation (`Escape` to close, focus management, ARIA labels/roles on level radios, status regions `aria-live="polite"`, and comparison table headers), and responsive layout/truncation/wrapping for long competency summaries, evidence quotes, and override notes on narrow viewports.
    5. **Meaningful Frontend Automated Tests (Vitest + React Testing Library):** Behavioral component and page integration tests covering async state transitions (`generating → complete`, `generating → failed → retry`), unassessed skill rendering, accessible override form validation/submission, and Fit/Gap table + narrative rendering.
  - **Focused Backend Support (~35% effort):**
    1. **Tenant Isolation & Authorization (F-01):** Scope `Portfolio`, `PortfolioSkill`, and `Vacancy` lookups through `Session` (`TenantScoped`) in `PortfoliosController`, `PortfolioSkillsController`, and `FitGapGeneratorWorker`.
    2. **Accurate Computation & API Contract (F-02, F-03, F-04, F-05):** Exclude `not_yet` (`probe_count == 0`) skills from L1–L5 fabrication in `Portfolios::Generator`, return `session_summary` and `unassessed_skills` in `PortfoliosController#show`, order `portfolio_skills` deterministically, validate `assessor_notes` in `AssessorOverride`, and emit `required_level`, `expected_level`, `is_override`, `ai_level`, and `assessor_notes` in `FitGap::Engine#build_skill_comparisons`.
    3. **Focused Backend Automated Tests (RSpec):** Request/service specs with deterministic AI mocks covering happy paths, unassessed skills, override validation, Fit/Gap contract fields, and cross-tenant `404` isolation.
- **Explicit Non-Goals:**
  - Modifying the Gemini Live bidirectional WebSocket audio pipeline (`AudioWebSocketMiddleware` / `GeminiLiveClient`).
  - Rewriting authentication (`JsonWebToken`) or multi-tenant middleware architecture (`TenantResolverMiddleware`).
  - Adding new database tables (all improvements use existing tables/JSONB fields cleanly).
- **Constraint Signal for Technical Lead Escalation:**
  - Cross-tenant IDOR on `/api/v1/portfolios/*` and `/api/v1/portfolio_skills/*` (F-01) and absence of `GEMINI_API_KEY` in local/CI environments. Temporary/local handling: scope all `Portfolio` / `PortfolioSkill` lookups through `Session` (`TenantScoped`), and provide deterministic AI fallback/mock harnesses for automated tests and local demonstration when `GEMINI_API_KEY` is not configured.



---

## Stage 4 (Revised): Solution Strategy and Acceptance Criteria (Declared Depth: `FRONTEND-HEAVY`)

### 1. Problem Statement & Scope
- **Declared Engineering Depth:** **`FRONTEND-HEAVY`** (fixed engineering direction across architecture, implementation, testing, PR description, and final report).
- **Core Problem:** Assessors, recruiters, and hiring managers evaluating a candidate after an AI interview rely on two connected screens—[`PortfolioPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/PortfolioPage.tsx) (`/assessments/:id/sessions/:sessionId/portfolio`) and [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/FitGapReportPage.tsx) (`/assessments/:id/sessions/:sessionId/fitgap/:vacancyId`). Today, this workflow fails across six verified seams (`F-01` through `F-06`):
  1. **Cross-Tenant IDOR & Unscoped Resource Resolution (`F-01`, P0):** [`PortfoliosController`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb), [`PortfolioSkillsController`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolio_skills_controller.rb), and [`FitGapGeneratorWorker`](file:///e:/New%20folder/ai-interview-platform/api/app/workers/fit_gap_generator_worker.rb) resolve `Portfolio`, `PortfolioSkill`, and `Vacancy` without explicit tenant predicates (`sessions.tenant_id` / `vacancies.tenant_id`), and [`ApiController`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/api_controller.rb) does not reject requests where an `X-Tenant-Scheme` header conflicts with the authenticated JWT's `scheme` claim.
  2. **Broken Fit/Gap Data Contract & Masked Narratives (`F-02` P0, `F-05` P1):** [`FitGap::Engine#build_skill_comparisons`](file:///e:/New%20folder/ai-interview-platform/api/app/services/fit_gap/engine.rb#L39-L70) emits `expected_level` and omits `required_level` and `is_override`, causing [`ComparisonTable.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx) to render a blank **Required** column and never display the `✏` override badge; [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/FitGapReportPage.tsx#L173) masks `overall_narrative` whenever `culture_narrative` exists; and `not_assessed` counts are omitted from summary metrics.
  3. **Ambiguous Assessment Semantics for Unprobed & Insufficient-Evidence Skills (`F-03`, P1):** [`Portfolios::Generator`](file:///e:/New%20folder/ai-interview-platform/api/app/services/portfolios/generator.rb) passes every `CoverageMap` row to the LLM and calls `.to_i.clamp(1, 5)`, turning unprobed (`not_yet`, `0` probes) or insufficient-evidence (`initiated`, `1` probe / `nil` level) skills into fabricated `L1` ratings (`gap`s) or silently omitting them from `PortfolioPage` with zero session-completeness context.
  4. **Hidden Latest Assessor Override Context & Non-Deterministic Ordering (`F-04`, P1):** [`SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx) never renders `override.assessor_notes` or the `AI Lx → Override Ly` provenance stored in [`AssessorOverride`](file:///e:/New%20folder/ai-interview-platform/api/app/models/assessor_override.rb), and `portfolio_skills` are returned without deterministic ordering.
  5. **Report Generation `404` Ambiguity, Duplicate Job Enqueueing & Stale Reports After Overrides (`F-06`, P2):** `GET /api/v1/portfolios/:id/fitgap/:vacancy_id` returns `404` both when parent resources (`Portfolio`/`Vacancy`) are missing/unauthorized and when a report is simply not yet generated (or was just invalidated by an assessor override), causing [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/FitGapReportPage.tsx#L39-L73) to re-POST `POST /fitgap` on every 5-second poll or across tab refreshes.

### 2. Core Scope, Stretch Goals & Explicit Non-Goals
- **Core Scope (Must-Have for 1-Day Budget):**
  1. **Explicit Tenant Isolation:** Enforce explicit `tenant_id` predicates across `Portfolio`, `PortfolioSkill`, `Vacancy`, `FitGapReport`, exports, and `FitGapGeneratorWorker`, plus JWT `scheme` vs. `X-Tenant-Scheme` consistency verification.
  2. **4-Tier Assessment Semantics:** Distinguish `not_probed`, `insufficient_evidence`, `partially_assessed`, and `assessed` consistently across `Portfolios::Generator`, `PortfoliosController#show` (`session_summary` + `unassessed_skills`), `FitGap::Engine`, `Exports::PdfGenerator`, `PortfolioPage.tsx`, and `ComparisonTable.tsx`.
  3. **Fit/Gap Generation Contract, Deduplication & Freshness:** Separate parent-resource `404` from report status (`not_generated`, `generating`, `ready`, `failed`) on `GET /fitgap/:vacancy_id`; prevent duplicate `FitGapGeneratorWorker` enqueueing/execution via a Redis lock/state tracker (`FitGap::GenerationTracker`); and ensure overrides immediately invalidate/refresh Fit/Gap reports and exports while keeping legacy records readable.
  4. **Frontend Evaluation & Fit/Gap Experience (`FRONTEND-HEAVY` Core):**
     - `PortfolioPage.tsx`: `SessionCoverageBanner`, `UnassessedSkillsSection`, deterministic skill ordering, and safe error vs. polling-timeout states.
     - `SkillPortfolioCard.tsx` & `OverridePanel.tsx`: **Latest Assessor Override** display (`AI Lx → Override Ly`, `assessor_notes`, `overridden_at`), accessible `LevelRadio` with `React.useId()`, focus restoration on close, preserved user input on save failure, and in-flight disabling during save.
     - `FitGapReportPage.tsx` & `ComparisonTable.tsx`: Populated `Required` (`L1–L5`) column, `✏` override badge + note context, separated **Overall Hiring Recommendation** and **Culture & Competency Fit** cards, complete summary badges (`Match`, `Exceeds`, `Gap`, `Not assessed`), and finite status-driven polling.
  5. **Automated Verification:** Bootstrap RSpec (`api/spec/`) and Vitest + React Testing Library (`web/`) and verify all acceptance criteria.
- **Stretch Goals (Only if Core + Tests Finish Early):**
  - Client-side skill filter tabs (`All / Configured / Discovered / Overridden / Low Confidence`) on `PortfolioPage.tsx`.
- **Explicit Non-Goals:**
  - Modifying the real-time binary WebSocket audio streaming pipeline (`AudioWebSocketMiddleware`, `GeminiLiveClient`).
  - Adding database migrations (all state and contract improvements fit cleanly within existing PostgreSQL tables, JSONB fields, and Redis).

### 3. Solution Options & Trade-Off Matrix (Comparing Viable Fullstack Approaches)

Both options below satisfy the assignment brief, close the P0 cross-tenant IDOR, fix the backend computation/contracts, and deliver a `FRONTEND-HEAVY` solution.

| Dimension | Option 1 (SELECTED): Focused Evaluation & Fit/Gap Reliability + Redis Generation Tracker | Option 2 (Viable Alternative): Schema Migration (`fit_gap_reports` State + Override History Table) + Expanded Workspace UI |
|---|---|---|
| **Architecture Summary** | Keeps existing PostgreSQL schema unchanged; uses a lightweight Redis tracker (`FitGap::GenerationTracker`) for Fit/Gap job deduplication/status and `overridden_at vs. generated_at` for freshness; focuses frontend depth on `PortfolioPage`, `SkillPortfolioCard`/`OverridePanel`, and `FitGapReportPage`/`ComparisonTable`. | Adds DB migrations for `fit_gap_reports.generation_status`/`error_code` and a multi-row `assessor_override_histories` table; expands the React UI with multi-facet filter tabs, an inline override history timeline, and a slide-over transcript drawer. |
| **Product & Candidate Impact** | **High:** Eliminates false `L1` gaps for unprobed/insufficient-evidence skills, surfaces Latest Assessor Override rationale across Portfolio/FitGap/PDF, fixes Required/Override columns & dual narratives, and enforces tenant isolation. | **High:** Same core fairness and accuracy guarantees, plus historical override version browsing and side-by-side transcript drawer. |
| **Frontend Complexity** | **High & Focused (`FRONTEND-HEAVY`):** Deterministic async state machines (`loading`, `not_generated`, `generating`, `ready`, `failed`, `timeout`), accessible `OverridePanel` + `LevelRadio` (`useId`, focus restoration, error recovery), `SessionCoverageBanner`, `UnassessedSkillsSection`, and responsive `ComparisonTable`. | **Very High:** Adds filter tab state machine, slide-over transcript drawer synchronization, and multi-entry override timeline component. |
| **Required Backend Changes** | **Focused:** `ApiController`, `PortfoliosController`, `PortfolioSkillsController`, `Portfolios::Generator`, `AssessorOverride`, `FitGap::Engine`, `FitGap::GenerationTracker`, `FitGapGeneratorWorker`, `Exports::PdfGenerator`. | **Broad:** Same service/controller changes plus 2 ActiveRecord migrations, new `AssessorOverrideHistory` model/serializer, and state-machine callbacks on `FitGapReport`. |
| **Implementation Cost (incl. Test Harness Setup)** | **~6.0 hours** (fits realistic 1-day budget including RSpec + Vitest setup and verification). | **~8.5–9.5 hours** (high risk of compressing automated test quality and documentation within 1 day). |
| **Maintainability & Reversibility** | **High:** Zero schema migrations; backwards-compatible with existing DB rows; isolated Redis lock with automatic TTL expiry. | **Medium:** Requires schema migrations and backfill logic for existing `fit_gap_reports` rows. |
| **Failure Modes** | If Redis restarts mid-generation, the transient `generating` marker expires and the next `GET` sees `not_generated` (or existing report), recovering cleanly. | If a worker crashes without running rescue callbacks, a DB `generation_status = 'generating'` row can remain stuck permanently without a stale-lock sweeper. |

- **Selection Rationale:** **Option 1** is selected because it solves every verified P0–P2 defect end-to-end with high frontend craft, zero destructive schema changes, self-healing Redis job deduplication, and leaves realistic time (~2.0 hours) to bootstrap RSpec and Vitest from scratch and write thorough behavioral tests.

---

### 4. Architectural Corrections & Detailed Specifications (Points 1–7)

#### 4.1 Explicit Tenant Isolation (Point 1)
- **Verified ActiveRecord Behavior:**
  - `Session` and `Vacancy` include [`TenantScoped`](file:///e:/New%20folder/ai-interview-platform/api/app/models/concerns/tenant_scoped.rb) (`default_scope { where(tenant_id: Current.tenant_id) if Current.tenant_id.present? }`), while `Portfolio`, `PortfolioSkill`, `AssessorOverride`, and `FitGapReport` do **not** have a `tenant_id` column and do **not** include `TenantScoped`.
  - In Rails 7, `Portfolio.joins(:session)` and `PortfolioSkill.joins(portfolio: :session)` generate `INNER JOIN "ai_interview"."sessions" ON "ai_interview"."sessions"."id" = "ai_interview"."portfolios"."session_id"` **without** applying `Session`'s `default_scope`!
  - Furthermore, [`TenantResolverMiddleware`](file:///e:/New%20folder/ai-interview-platform/api/app/middlewares/tenant_resolver_middleware.rb) resolves `X-Tenant-Scheme` before [`ApiController#resolve_tenant_from_jwt`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/api_controller.rb#L18-L26) runs, and `resolve_tenant_from_jwt` returns early (`return if tenant_resolved?`). Without an explicit cross-check, a caller with a valid JWT for `other-corp` could pass `X-Tenant-Scheme: test-corp` and set `Current.tenant_id` to `test-corp`.
- **Mandatory Tenant-Scoping Rules:**
  1. **Trusted Tenant Context (`Api::V1::ApiController`):**
     - In `resolve_tenant_from_jwt` (or a `verify_tenant_matches_jwt!` `before_action`), if `current_user&.scheme.present?` and `Current.organization.present?`, verify `Current.organization.scheme == current_user.scheme`. If they disagree, raise `ExceptionHandler::Unauthorized, Message.unauthorized` (`403 Forbidden`).
  2. **Portfolio Access (`PortfoliosController`):**
     - Session-based lookup: `@session = Session.where(tenant_id: current_tenant_id).find(params[:id])`
     - Direct portfolio lookup helper (`find_tenant_portfolio!(id)`):
       ```ruby
       Portfolio.joins(:session)
                .where(sessions: { tenant_id: current_tenant_id })
                .find(id)
       ```
  3. **PortfolioSkill Override (`PortfolioSkillsController`):**
     - Explicit tenant-scoped lookup:
       ```ruby
       @portfolio_skill = PortfolioSkill.joins(portfolio: :session)
                                        .where(sessions: { tenant_id: current_tenant_id })
                                        .find(params[:id])
       ```
  4. **Vacancy Selection (`PortfoliosController#fitgap`, `#regenerate_fitgap`, `#show_fitgap`, `#export`):**
     - Explicit tenant-scoped lookup helper (`find_tenant_vacancy(vacancy_id)`):
       ```ruby
       Vacancy.unscoped.where(tenant_id: current_tenant_id).find_by(id: vacancy_id)
       ```
  5. **Report Reads & Exports (`PortfoliosController#show_fitgap`, `#export`):**
     - Always resolve `portfolio = find_tenant_portfolio!(params[:id])` first. When `vacancy_id` is supplied, resolve `vacancy = find_tenant_vacancy(vacancy_id)` (raising `ActiveRecord::RecordNotFound` / returning `404` if `vacancy` is nil or belongs to another tenant) before querying `FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)`.
  6. **Background-Worker Resource Resolution (`FitGapGeneratorWorker`):**
     - Workers execute outside HTTP middleware (`Current.tenant_id` is `nil`).
     - In `FitGapGeneratorWorker#perform(portfolio_id, vacancy_id)`:
       ```ruby
       portfolio = Portfolio.includes(:session).find(portfolio_id)
       tenant_id = portfolio.session.tenant_id
       vacancy   = Vacancy.unscoped.where(tenant_id: tenant_id).find(vacancy_id)
       ```
       If `vacancy` does not belong to `portfolio.session.tenant_id`, `ActiveRecord::RecordNotFound` is raised and logged, preventing cross-tenant report creation.

#### 4.2 Report Generation Contract & Duplicate-Request Protection (Point 2)
- **Disambiguating `GET /api/v1/portfolios/:id/fitgap/:vacancy_id`:**
  - **Missing or Cross-Tenant Parent Resource (`Portfolio` or `Vacancy`):** Returns **`404 Not Found`** (`{ errors: [{ status: 404, code: "resource_not_found", message: "Portfolio or vacancy not found" }] }`). The frontend treats `404` as a terminal not-found error and **never** calls `POST /fitgap`.
  - **Valid Parent Resources (`Portfolio` and `Vacancy` both exist in `current_tenant_id`):**
    - **Report Not Generated Yet:** Returns **`200 OK`** with `{ status: "not_generated", report: nil }`.
    - **Generation In Progress (initial generation or post-override regeneration):** Returns **`202 Accepted`** (or `200 OK`) with `{ status: "generating", stale: <boolean>, report: nil }`.
    - **Generation Failed (last worker run failed):** Returns **`200 OK`** with `{ status: "failed", error_code: "generation_failed", message: "Unable to generate fit/gap report. Please try again.", report: nil }`.
    - **Report Ready & Fresh:** Returns **`200 OK`** with `{ status: "ready", report: fit_gap_json(report) }`.
- **Backend Deduplication & Idempotency (`FitGap::GenerationTracker`):**
  - Uses the existing Redis connection (`Sidekiq.redis` / `ENV['REDIS_URL']`) with two keys per `(portfolio_id, vacancy_id)` pair:
    - `fitgap:lock:#{portfolio_id}:#{vacancy_id}` (`SET NX EX 90`): Atomic enqueue/execution guard.
    - `fitgap:state:#{portfolio_id}:#{vacancy_id}` (`EX 300`): Stores JSON `{ status: "generating" | "failed", error_code: ..., updated_at: ... }`.
  - **When `POST /api/v1/portfolios/:id/fitgap` is called:**
    1. Verify `portfolio` and `vacancy` belong to `current_tenant_id` and `portfolio.complete?`.
    2. Check if a fresh `FitGapReport` already exists (`existing.present? && !report_stale?(portfolio, existing)`). If so, return `200 OK` with `{ status: "ready", report: fit_gap_json(existing) }`.
    3. Attempt `FitGap::GenerationTracker.try_lock_and_enqueue(portfolio.id, vacancy.id)`.
       - If the lock is newly acquired (`SET NX` returns true), mark state `"generating"` and enqueue `FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)`.
       - If the lock is already held, do **not** enqueue a duplicate job; simply return `202 Accepted` with `{ status: "generating" }`.
  - **When `FitGapGeneratorWorker#perform(portfolio_id, vacancy_id)` runs:**
    - Uses a worker execution lock (`fitgap:worker_exec:#{portfolio_id}:#{vacancy_id}`, `SET NX EX 60`) so even if two jobs were queued, only one executes at a time.
    - On success: clears `fitgap:lock` and `fitgap:state` so `GET /fitgap/:vacancy_id` serves the newly persisted `FitGapReport`.
    - On failure: clears `fitgap:lock` and sets `fitgap:state` to `{ status: "failed", error_code: "generation_failed" }` (TTL `300s`).
  - **Behavior Across Refresh, Remount, Multiple Tabs, and Concurrent Requests:**
    - **First Mount (`status: "not_generated"`):** Frontend sees `status === "not_generated"`, sets local `autoTriggeredRef.current = true`, and fires `POST /fitgap` once.
    - **Refresh / Remount / Second Tab while generating:** `GET /fitgap/:vacancyId` returns `{ status: "generating" }`. The frontend immediately enters the `generating` polling loop **without** calling `POST /fitgap`.
    - **Concurrent Requests (two tabs open simultaneously at `not_generated`):** Both tabs may send `POST /fitgap`, and `FitGap::GenerationTracker.try_lock_and_enqueue` guarantees **at most one** Sidekiq job is enqueued while both tabs receive `202 Accepted ({ status: "generating" })`.

#### 4.3 Four-Tier Assessment Semantics (Point 3)
We reconcile `session.assessment.assessment_skills.order(:order)` against `session.coverage_maps.index_by(&:skill_id)` so no configured skill is ever lost (even if a session ended before `coverage_maps` were initialized).

| Tier | Domain Classification | Coverage / Evidence Condition | `Portfolios::Generator` Behavior | `PortfolioPage` & `session_summary` Behavior | `FitGap::Engine` & Export Behavior |
|---|---|---|---|---|---|
| **1** | **Not Probed** (`reason: "not_probed"`) | Missing `CoverageMap` row, OR `state == 'not_yet'`, OR `probe_count.to_i == 0`. | **Excluded** from LLM `configured_skills` scoring prompt; **never** saved as a `PortfolioSkill` row. | Listed in `unassessed_skills` (`reason: "not_probed"`, badge: *Not Probed — 0 probes*). Counted in `unassessed_skills_count`. | `result: "not_assessed"`, `assessment_status: "not_probed"`, `candidate_level: nil`, `delta: nil`. |
| **2** | **Probed, Insufficient Evidence** (`reason: "insufficient_evidence"`) | `state == 'initiated'` (`probe_count == 1`, below `Coverage::StateEngine::MIN_PROBES_FOR_PARTIAL = 2`), OR LLM returns `ai_level: nil` / empty evidence quotes. | **Never** clamped via `nil.to_i.clamp(1, 5)` into `L1`. Omitted from `portfolio_skills` and recorded in `unassessed_skills` (`reason: "insufficient_evidence"`). | Listed in `unassessed_skills` (`reason: "insufficient_evidence"`, badge: *Insufficient Evidence — 1 probe*). Counted in `unassessed_skills_count`. | `result: "not_assessed"`, `assessment_status: "insufficient_evidence"`, `candidate_level: nil`, `delta: nil`. |
| **3** | **Partially Assessed** (`assessment_status: "partial"`) | `state == 'partial'` (`probe_count >= 2`) with valid LLM `ai_level` (`1..5`) and verbatim evidence. | Saved in `portfolio_skills` with `ai_level` (`1..5`) and `ai_confidence` capped at `'low'` or `'medium'` (never `'high'`). | Rendered as a scored `SkillPortfolioCard` with `Partial coverage` / confidence indicator. Counted in `assessed_skills_count`. | Evaluated with `candidate_level` (`1..5`), `delta`, and `result` (`match` / `exceed` / `gap`). |
| **4** | **Assessed / Covered** (`assessment_status: "covered"`) | `state == 'covered'` (`probe_count >= 2`) with valid LLM `ai_level` (`1..5`) and verbatim evidence. | Saved in `portfolio_skills` with `ai_level` (`1..5`) and `ai_confidence` (`'high'` when `probe_count >= 3`, else `'medium'`/`'low'`). | Rendered as a scored `SkillPortfolioCard`. Counted in both `assessed_skills_count` and `covered_skills_count`. | Evaluated with `candidate_level` (`1..5`), `delta`, and `result` (`match` / `exceed` / `gap`). |

- **Mathematical Invariant in `session_summary`:**
  - `configured_skills_count` = total configured `AssessmentSkill`s on the assessment.
  - `assessed_skills_count` = configured skills that produced a scored `PortfolioSkill` (`partially_assessed` + `assessed`).
  - `unassessed_skills_count` = configured skills in `unassessed_skills` (`not_probed` + `insufficient_evidence`).
  - `assessed_skills_count + unassessed_skills_count == configured_skills_count`.

#### 4.4 Existing Data Backwards Compatibility & Report Freshness After Overrides (Point 4)
- **Backwards Compatibility for Pre-Existing Records (Zero Destructive Read Rewrites):**
  - **Legacy `FitGapReport` rows:** `PortfoliosController#fit_gap_json` normalizes each entry in `report.skill_comparisons` on read without mutating the DB:
    - `required_level`: `entry["required_level"] || entry["expected_level"]`
    - `expected_level`: `entry["expected_level"] || entry["required_level"]`
    - `is_override`: `entry.key?("is_override") ? entry["is_override"] : entry["overridden"].present?`
  - **Legacy `Portfolio` rows:** If an existing portfolio was generated before the fix (e.g., a `not_yet` skill was persisted as `ai_level: 1`), `GET /api/v1/sessions/:id/portfolio` does **not** delete rows on read. Instead, `portfolio_skill_json` attaches `coverage_state` and `probe_count` from `coverage_maps`, and `POST /api/v1/sessions/:id/portfolio/regenerate` is updated to allow regeneration when `portfolio.failed?` OR `params[:force] == true`.
- **Report Freshness Across `Portfolio` → `Override` → `FitGap` → `Export`:**
  - Define `report_stale?(portfolio, report)`:
    ```ruby
    latest_override_at = portfolio.assessor_overrides.maximum(:overridden_at)
    latest_override_at.present? && report.generated_at < latest_override_at
    ```
  - **When an assessor creates/updates an override (`PortfolioSkillsController#override`):**
    1. `AssessorOverride` saves `overridden_at: Time.current`.
    2. `regenerate_stale_fitgap_reports` finds all `FitGapReport.where(portfolio_id: portfolio.id)` and calls `FitGap::GenerationTracker.force_regenerate(portfolio.id, report.vacancy_id)` (which marks Redis status `"generating"`, destroys the stale report, and enqueues `FitGapGeneratorWorker`).
  - **If `GET /api/v1/portfolios/:id/fitgap/:vacancy_id` is called before regeneration finishes (or if an in-flight worker wrote a report older than `latest_override_at`):**
    - If `report.nil?` and tracker status is `"generating"`, returns `202 Accepted ({ status: "generating", report: nil })`.
    - If `report.present?` and `report_stale?(portfolio, report)` is true, triggers `FitGap::GenerationTracker.try_lock_and_enqueue(portfolio.id, vacancy.id)` and returns `202 Accepted ({ status: "generating", stale: true, report: nil })` so `FitGapReportPage` never renders stale pre-override numbers as final.
  - **If `GET /api/v1/portfolios/:id/export` is called while a `FitGapReport` is stale:**
    - `Exports::PdfGenerator` already reads `portfolio.portfolio_skills` and `portfolio.assessor_overrides` live for the portfolio section. For the Fit/Gap section (and in `build_export_json`), if `report` is stale (`report_stale?(portfolio, report)`), we recompute `skill_comparisons` synchronously via `FitGap::Engine.new(portfolio: @portfolio, vacancy: vacancy).send(:build_skill_comparisons)` so exported PDF and JSON files are **always 100% consistent** with the latest assessor override!

#### 4.5 Safe Error Presentation vs. Polling Timeouts (Point 5)
- **Sanitized API Error Contract (No Raw Exception Leakage):**
  - `Portfolio#generation_error` is logged server-side (`Rails.logger.error`), never rendered verbatim in the browser.
  - `PortfoliosController` maps `generation_error` to a safe, user-facing structure:
    - `error_code`: `"ai_service_unavailable" | "invalid_ai_response" | "generation_failed"`
    - `error`: `"We couldn't complete the AI portfolio analysis due to an upstream service error. Your interview transcript is safe—please retry generation."`
- **Distinguishing Confirmed Failure from Client Polling Timeout:**
  - **`status === "failed"` (Confirmed Backend Failure):**
    - `PortfolioPage` and `FitGapReportPage` render an error alert (`role="alert"`) with the safe user-facing message and a **Retry Generation** button (`POST /regenerate` or `POST /regenerate_fitgap`).
  - **Polling Timeout (12 polls / 60s elapsed while `status === "generating"`):**
    - Neither page claims that generation failed or automatically re-POSTs a new job.
    - Instead, the UI transitions to a `timeout` state (`role="status"`): *"Analysis is still processing in the background and is taking longer than usual."*
    - Provides a primary **Check Status** button (which calls `GET /portfolio` or `GET /fitgap/:vacancyId` and resumes polling without enqueueing a duplicate job) and a secondary **Restart Generation** button if the assessor explicitly wants to force-requeue.

#### 4.6 Mock and Demo Behavior Separation (Point 6)
- **Production & Default Runtime:**
  - `Portfolios::Generator` and `FitGap::Engine` use `Gemini::HttpClient` by default and **never** inspect `ENV['GEMINI_API_KEY']` for placeholder strings (`your_gemini_api_key_here`) to silently fabricate fake LLM responses. If the upstream API call fails or key is invalid in normal runtime, the service raises/handles the error as designed.
- **Automated Tests (RSpec & Vitest):**
  - Backend RSpec specs inject deterministic test doubles via constructor keyword arguments (`Portfolios::Generator.new(session, gemini_client: fake_gemini_client)` and `FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: fake_gemini_client)`).
  - Frontend Vitest suites mock the Axios client functions (`web/src/services/api.ts`).

#### 4.7 Frontend Accessibility, Override Behavior & Documented Assumptions (Point 7)
- **Verified `RadioGroup` Implementation (`web/src/components/ui/radio-group.tsx` & `LevelRadio.tsx`):**
  - [`radio-group.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/ui/radio-group.tsx) wraps `@radix-ui/react-radio-group`, which already provides `role="radiogroup"`, `role="radio"`, `aria-checked`, roving `tabIndex`, and arrow-key navigation.
  - The concrete bug in [`LevelRadio.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/LevelRadio.tsx#L22-L34) is that it uses hardcoded `id={`level-${level}`}` and `<label htmlFor={`level-${level}`}>` without `React.useId()`, and omits `aria-label` on `<RadioGroup>`. We will fix `LevelRadio.tsx` using `const instanceId = React.useId()` (`id={`${instanceId}-level-${level}`}`) and an explicit `ariaLabel` prop.
- **Focus & State Correctness in `OverridePanel.tsx`:**
  1. **Focus Management:** Store a ref (`triggerButtonRef`) on the `Override rating` / `Edit override` button. When `OverridePanel` opens, focus moves to the notes `Textarea` (or `LevelRadio`). When `OverridePanel` closes (via `Cancel`, `Escape` key, or successful `Save override`), call `triggerButtonRef.current?.focus()` so keyboard users never lose their place in the skill card list.
  2. **Failed Save Recovery:** If `overrideSkill(...)` rejects (e.g. `422` or network failure), `OverridePanel` remains `open`, preserves the assessor's `overrideLevel` and `notes` state, and displays an inline `role="alert"` error message.
  3. **In-Flight Close Prevention:** While `saving === true`, disable the `LevelRadio`, `Textarea`, `Save override`, and `Cancel` buttons, and ignore `Escape` key events until the request settles.
- **Accurate Terminology Matching `AssessorOverride` Persistence (`has_one :assessor_override`):**
  - Because `PortfolioSkill` has `has_one :assessor_override` (which stores the current override `ai_level`, `override_level`, `assessor_notes`, `overridden_by`, `overridden_at` and updates in place on re-override), the UI labels this section **Latest Assessor Override** (rather than a multi-entry historical audit log).
- **Explicitly Labeled Product Assumptions:**
  - **Assumption A-01 (Minimum Override Rationale — 5 Characters):** Requiring `assessor_notes` (trimmed length $\ge 5$ characters) when submitting an override is a **Product Assumption** (not an existing database constraint), introduced to ensure human overrides carry an explainable rationale aligned with UU PDP Pasal 10.
  - **Assumption A-02 (Low-Confidence Review Badge):** Surfacing a visual *Review suggested* callout when `ai_confidence === 'low'` and unoverridden is a **Product Assumption** to guide assessor attention.

---

### 5. Frontend Design (`FRONTEND-HEAVY`)

#### 5.1 Information Hierarchy
1. **`PortfolioPage` (`/assessments/:id/sessions/:sessionId/portfolio`):**
   - **Header & Actions:** Candidate Name, Assessment Title, Back navigation, `Transcript` link, `Export PDF`, `Export JSON`.
   - **Session Completeness & Coverage Banner (`SessionCoverageBanner`):** Displays session `status`, human-readable `end_reason` (*All Skills Covered*, *Ended Early by Candidate*, *Ended by Assessor*, *Time Limit Reached*, *Interrupted by Error*), duration, and coverage counts (`X of Y configured skills assessed`, `Z unassessed`).
   - **Configured Skills (`SkillPortfolioCard`):** Deterministically ordered (`order(:is_discovered, :id)`); displays `LevelBadge`, `ConfidenceIndicator`, **Latest Assessor Override** block (when overridden: `AI Lx → Override Ly`, `assessor_notes`, formatted `overridden_at`), verbatim `Evidence` quotes (`break-words`), `Competency summary`, and accessible `OverridePanel`.
   - **Unassessed Skills Section (`UnassessedSkillsSection`):** Lists configured skills that were not scored, clearly distinguishing **Not Probed** (`0 probes`) from **Insufficient Evidence** (`1 probe` / no assessable signal), alongside their target `expected_level` and note that they are marked *Not Assessed* (not penalized as a gap) in Fit/Gap reports.
   - **Discovered Skills Section:** Additional skills surfaced during the interview.
   - **Vacancy Fit/Gap Launcher:** Vacancy selector + `Run Fit/Gap Analysis →`.
2. **`FitGapReportPage` (`/assessments/:id/sessions/:sessionId/fitgap/:vacancyId`):**
   - **Header & Vacancy Context:** Vacancy Role Title, Candidate Name, `Regenerate`, `Export PDF`, `Export JSON`.
   - **Overall Hiring Recommendation Card:** Dedicated card rendering `overall_narrative` and summary counts (`Match`, `Exceeds`, `Gap`, `Not assessed`).
   - **Skill Comparison Table (`ComparisonTable`):** Responsive table (`overflow-x-auto`) with columns:
     - `Skill` (`skill_label`, wrapping cleanly on narrow screens)
     - `Required` (`L1–L5` via `required_level ?? expected_level`)
     - `Candidate` (`L1–L5` + `✏ Override` badge showing `AI Lx → Ly` and `assessor_notes`, or `Not assessed (Not probed / Insufficient evidence)`)
     - `Result` (`Match`, `Exceeds +Δ`, `Gap -Δ`, `Not assessed`)
   - **Culture & Competency Fit Card:** Dedicated card rendering `culture_narrative` (never masking `overall_narrative`).
   - **Discovered Skills Section:** Assessed skills outside the vacancy requirements.

#### 5.2 State-Transition Table

| Screen / Component | Current State | Event | Next State | Visible Feedback (`aria-live`) | Allowed User Actions |
|---|---|---|---|---|---|
| **`PortfolioPage`** | `loading` | Initial mount | `generating` \| `complete` \| `failed` \| `not_found` | 3 `Skeleton` placeholders (`aria-busy="true"`). | Navigate back. |
| **`PortfolioPage`** | `generating` | 5s poll returns `status: "generating"` (`< 12` polls) | `generating` | Spinner + `"Generating portfolio..."` (`role="status"`). | Navigate back, view `Transcript`. |
| **`PortfolioPage`** | `generating` | Poll reaches 12 attempts (60s) while still `generating` | `timeout` | Info/warning card: `"Analysis is still processing..."` (`role="status"`). | `Check Status` (`GET` only), `Restart Generation` (`POST`), view `Transcript`. |
| **`PortfolioPage`** | `generating` \| `loading` | API returns `generation_status: "complete"` | `complete` | Renders `SessionCoverageBanner`, scored `SkillPortfolioCard`s, and `UnassessedSkillsSection`. | Override ratings, Export PDF/JSON, Select Vacancy & Run Fit/Gap. |
| **`PortfolioPage`** | `generating` \| `loading` | API returns `generation_status: "failed"` | `failed` | Destructive alert (`role="alert"`) with sanitized user message + `Retry Generation` button. | Click `Retry Generation`, view `Transcript`, navigate back. |
| **`OverridePanel`** | `collapsed` | User clicks `Override rating` / `Edit override` | `editing` | Opens panel, moves focus into panel, pre-fills level and notes. | Select `L1–L5`, type `assessor_notes`, `Save override`, `Cancel` / `Escape`. |
| **`OverridePanel`** | `editing` | User clicks `Save` with notes `< 5` chars | `editing` (invalid) | Inline `role="alert"`: `"Please provide a brief rationale (at least 5 characters)."` | Edit notes/level, `Cancel` / `Escape` (restores focus to trigger). |
| **`OverridePanel`** | `editing` | User clicks `Save` with valid notes | `saving` | Spinner on `Save override`; disables radio, textarea, `Save`, `Cancel`, and `Escape`. | Wait for response. |
| **`OverridePanel`** | `saving` | `POST /override` returns `200/201` | `collapsed` | Closes panel, restores focus to trigger button, updates **Latest Assessor Override** block on card. | Click `Edit override` to revise. |
| **`OverridePanel`** | `saving` | `POST /override` fails (`422` / network error) | `editing` (error) | Keeps panel open, preserves typed `notes` and `overrideLevel`, displays `role="alert"` error. | Retry `Save override` or `Cancel`. |
| **`FitGapReportPage`** | `loading` | `GET /fitgap/:vacancyId` returns `404` | `not_found` | Terminal error card: `"Portfolio or vacancy not found."` (Does **not** trigger `POST /fitgap`). | Navigate back. |
| **`FitGapReportPage`** | `loading` | `GET /fitgap/:vacancyId` returns `{ status: "not_generated" }` | `generating` | Calls `POST /fitgap` **once** (`autoTriggeredRef`); shows `"Generating fit/gap report..."`. | Navigate back. |
| **`FitGapReportPage`** | `loading` \| `generating` | `GET /fitgap/:vacancyId` returns `{ status: "generating" }` | `generating` | Polls `GET /fitgap/:vacancyId` every 5s (up to 12 polls) **without** calling `POST /fitgap`. | Navigate back. |
| **`FitGapReportPage`** | `generating` | Poll reaches 12 attempts (60s) while still `generating` | `timeout` | Warning card: `"Fit/gap report is still processing..."` | `Check Status` (`GET` only) or `Regenerate` (`POST /regenerate_fitgap`). |
| **`FitGapReportPage`** | `loading` \| `generating` | `GET /fitgap/:vacancyId` returns `{ status: "failed" }` | `failed` | Error alert (`role="alert"`) with sanitized message + `Retry Generation` button. | Click `Retry Generation`, navigate back. |
| **`FitGapReportPage`** | `loading` \| `generating` | `GET /fitgap/:vacancyId` returns `{ status: "ready", report }` | `ready` | Renders **Overall Hiring Recommendation**, **ComparisonTable**, and **Culture & Competency Fit** cards. | `Regenerate`, `Export PDF`, `Export JSON`, navigate back. |

---

### 6. Acceptance Criteria & Verification Mapping

| ID | Acceptance Criterion (Observable Behavior) | Verification Method |
|---|---|---|
| **AC-01** | **Strict Cross-Tenant Isolation & Zero Side Effects (`F-01`):** Given Tenant A (`test-corp`) owns a `Session`, `Portfolio`, `PortfolioSkill`, and `Vacancy`, when an authenticated user from Tenant B (`other-corp`) requests `GET /api/v1/sessions/:id/portfolio`, `GET /api/v1/portfolios/:id/export`, `POST /api/v1/portfolios/:id/fitgap`, `POST /api/v1/portfolios/:id/regenerate_fitgap`, `GET /api/v1/portfolios/:id/fitgap/:vacancy_id`, or `POST /api/v1/portfolio_skills/:id/override` (or sends a mismatched `X-Tenant-Scheme: test-corp` header with Tenant B's JWT), then the API denies access (`404 Not Found` or `403 Forbidden` on header mismatch) and causes **zero side effects** (no DB writes, no report deletions, and zero Sidekiq jobs enqueued). Furthermore, `FitGapGeneratorWorker` refuses to pair a `Portfolio` and `Vacancy` from different tenants. | Backend RSpec request & worker specs |
| **AC-02** | **4-Tier Assessment Semantics (`F-03`):** Given an assessment with configured skills across `not_yet` (`0` probes), `initiated` (`1` probe / insufficient evidence), `partial` (`2` probes), and `covered` (`3` probes), when `Portfolios::Generator` runs and `GET /api/v1/sessions/:id/portfolio` is called, then only `partial` and `covered` skills are persisted as scored `PortfolioSkill` rows (`L1–L5`), while `not_yet` and `initiated` skills are excluded from `portfolio_skills` and returned in `unassessed_skills` with `reason: "not_probed"` and `reason: "insufficient_evidence"` respectively, and `assessed_skills_count + unassessed_skills_count == configured_skills_count`. | Backend RSpec service & request specs |
| **AC-03** | **Session Completeness & Unassessed Skills Presentation (`F-03`):** Given a portfolio with both assessed skills and `unassessed_skills` (`not_probed` and `insufficient_evidence`), when `PortfolioPage` renders, then `SessionCoverageBanner` displays the session end reason, duration, and coverage counts, and `UnassessedSkillsSection` renders each unassessed skill with its distinct reason badge (*Not Probed* vs. *Insufficient Evidence*) and target `expected_level`. | Frontend Vitest/RTL test + Manual browser check |
| **AC-04** | **Latest Assessor Override Validation, Focus Management & Error Recovery (`F-04`, Assumption A-01):** Given `OverridePanel` on `SkillPortfolioCard`, when the assessor attempts to save with `< 5` characters of `assessor_notes`, inline validation blocks submission with `role="alert"` (and backend returns `422`). While saving, inputs and close actions are disabled. If the API call fails, the panel remains open and preserves typed notes and selected level. When saved or cancelled (`Cancel`/`Escape`), focus returns to the trigger button and `SkillPortfolioCard` renders the **Latest Assessor Override** block (`AI Lx → Override Ly`, `assessor_notes`, timestamp). | Frontend Vitest/RTL test + Backend RSpec request spec |
| **AC-05** | **Accessible `LevelRadio` with Unique IDs (`a11y`):** Given multiple `LevelRadio` instances rendered on the page, each radio group uses unique DOM IDs (`React.useId()`) and an explicit `aria-label` on the Radix `RadioGroup` root. | Frontend Vitest/RTL test |
| **AC-06** | **Fit/Gap Table Required Level, Override Provenance & Dual Narratives (`F-02`, `F-05`):** Given a `FitGapReport` with matched, exceeded, gap, overridden, and `not_assessed` skills plus both `overall_narrative` and `culture_narrative`, when `FitGapReportPage` renders, then `ComparisonTable` displays `L1–L5` in the **Required** column (for both new and legacy reports), displays the `✏` override indicator + `AI Lx → Ly` note context on overridden skills, displays `Not assessed` on unassessed skills, shows all 4 summary counts (`Match`, `Exceeds`, `Gap`, `Not assessed`), and renders **Overall Hiring Recommendation** and **Culture & Competency Fit** in two separate cards. | Frontend Vitest/RTL test + Backend RSpec service spec |
| **AC-07** | **Report Generation Contract, Deduplication & Override Freshness (`F-06`):** Given `GET /api/v1/portfolios/:id/fitgap/:vacancy_id`: (a) when `Portfolio` or `Vacancy` is missing/cross-tenant, it returns `404` and `FitGapReportPage` does **not** call `POST /fitgap`; (b) when the report is not yet generated, `GET` returns `200 ({ status: "not_generated" })`, `FitGapReportPage` calls `POST /fitgap` once, and subsequent polls/refreshes/concurrent tabs seeing `{ status: "generating" }` do **not** enqueue duplicate `FitGapGeneratorWorker` jobs; (c) when an assessor saves a skill override, any existing `FitGapReport` for that portfolio is marked stale/regenerating and exports immediately reflect the updated override level. | Backend RSpec request spec + Frontend Vitest/RTL test |
| **AC-08** | **Sanitized Error Presentation vs. Polling Timeout (`F-06`):** Given a portfolio or Fit/Gap report whose generation fails with an internal exception, the API logs the raw error server-side and returns a sanitized user-facing error message (`role="alert"` + `Retry Generation` button). Conversely, if polling reaches 12 attempts (60s) while still `"generating"`, the UI displays a `"still processing"` timeout notice with a `Check Status` (`GET`) action rather than falsely reporting failure or auto-triggering a duplicate `POST`. | Frontend Vitest/RTL test + Backend RSpec request spec |
| **AC-09** | **Responsive Layout & Long-Text Handling:** Given long skill labels, multi-sentence verbatim transcript quotes, and long `assessor_notes`, when rendered at `375px` viewport width, text wraps cleanly (`break-words`) and `ComparisonTable` scrolls horizontally (`overflow-x-auto`) without clipping interactive controls. | Manual visual check at `375px` & `1280px` |

---

### 7. Realistic Implementation Plan & Time Budget (~6.0 Hours)

1. **Step 1 — Backend Tenant Isolation, 4-Tier Semantics, Fit/Gap Tracker & Contracts (~1.75h):**
   - Enforce JWT `scheme` vs. `X-Tenant-Scheme` verification in [`ApiController`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/api_controller.rb) and explicit `where(sessions: { tenant_id: current_tenant_id })` / `Vacancy.unscoped.where(tenant_id: ...)` scoping in [`PortfoliosController`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb), [`PortfolioSkillsController`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolio_skills_controller.rb), and [`FitGapGeneratorWorker`](file:///e:/New%20folder/ai-interview-platform/api/app/workers/fit_gap_generator_worker.rb).
   - Update [`Portfolios::Generator`](file:///e:/New%20folder/ai-interview-platform/api/app/services/portfolios/generator.rb) and `PortfoliosController#show` to implement the 4-tier assessment semantics (`not_probed`, `insufficient_evidence`, `partially_assessed`, `assessed`), reconcile against `assessment.assessment_skills`, order `portfolio_skills`, and sanitize `generation_error`.
   - Add `assessor_notes` validation (minimum 5 chars after strip) in [`AssessorOverride`](file:///e:/New%20folder/ai-interview-platform/api/app/models/assessor_override.rb).
   - Implement `FitGap::GenerationTracker` (Redis atomic lock + status state) and update `PortfoliosController` (`fitgap`, `show_fitgap`, `regenerate_fitgap`, `export`), [`FitGap::Engine`](file:///e:/New%20folder/ai-interview-platform/api/app/services/fit_gap/engine.rb), and [`Exports::PdfGenerator`](file:///e:/New%20folder/ai-interview-platform/api/app/services/exports/pdf_generator.rb) for `required_level`, `is_override`, `assessor_notes`, legacy normalization, and post-override freshness.
2. **Step 2 — Backend RSpec Bootstrap & Focused Specs (~1.25h):**
   - Initialize `api/spec/spec_helper.rb` and `api/spec/rails_helper.rb`.
   - Write request, service, and worker specs covering **AC-01**, **AC-02**, **AC-04 (backend)**, **AC-06 (backend)**, **AC-07 (backend)**, and **AC-08 (backend)**.
3. **Step 3 — Frontend Architecture, Components, State Machines & Accessibility (`FRONTEND-HEAVY` Core, ~1.75h):**
   - Update TypeScript interfaces in [`web/src/types/index.ts`](file:///e:/New%20folder/ai-interview-platform/web/src/types/index.ts) and API helpers in [`web/src/services/api.ts`](file:///e:/New%20folder/ai-interview-platform/web/src/services/api.ts).
   - Update [`LevelRadio.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/LevelRadio.tsx) (`React.useId()` + `ariaLabel`).
   - Update [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx) and [`SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx) (**Latest Assessor Override** display, validation, focus restoration, error preservation, in-flight lock, `break-words`).
   - Update [`PortfolioPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/PortfolioPage.tsx) (`SessionCoverageBanner`, `UnassessedSkillsSection` with *Not Probed* vs. *Insufficient Evidence*, sanitized error vs. polling timeout state).
   - Update [`ComparisonTable.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx) and [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/FitGapReportPage.tsx) (`Required` column, `✏ Override` badge + notes, separated **Overall Hiring Recommendation** and **Culture & Competency Fit** cards, `Not assessed` summary count, and status-driven finite polling).
4. **Step 4 — Frontend Vitest + React Testing Library Setup & Behavioral Tests (~1.25h):**
   - Configure Vitest, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, and `@testing-library/jest-dom` in `web/`.
   - Write behavioral test suites for `PortfolioPage`, `SkillPortfolioCard`/`OverridePanel`, and `FitGapReportPage`/`ComparisonTable` covering **AC-03** through **AC-08**.


---

## Stage 5A: Focused Backend Implementation (Declared Depth: `FRONTEND-HEAVY`)

### 1. Summary of Backend Changes
1. **Trusted Tenant Context & Explicit Tenant Scoping (`AC-01`):**
   - [`ApplicationController#authenticate_with_roles!`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/application_controller.rb#L54-L72): Added `verify_authenticated_tenant!` ensuring the authenticated user's JWT `scheme` claim is non-blank, matches `Current.organization.scheme`, and matches `X-Tenant-Scheme` whenever that header is supplied (`403 Forbidden` on mismatch).
   - [`PortfoliosController`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L180-L206): Enforced explicit `Session.where(tenant_id: current_tenant_id)`, `Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })`, and `Vacancy.unscoped.where(tenant_id: current_tenant_id)` lookups across `show`, `regenerate`, `export`, `fitgap`, `regenerate_fitgap`, and `show_fitgap`.
   - [`PortfolioSkillsController`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolio_skills_controller.rb#L48-L55): Scoped `set_portfolio_skill` via `PortfolioSkill.joins(portfolio: :session).where(sessions: { tenant_id: current_tenant_id }).find(params[:id])`.
   - [`FitGapGeneratorWorker`](file:///e:/New%20folder/ai-interview-platform/api/app/workers/fit_gap_generator_worker.rb#L8-L27): Scoped `Vacancy` resolution to `Vacancy.unscoped.where(tenant_id: portfolio.session.tenant_id).find(vacancy_id)` so background jobs cannot pair cross-tenant records.
2. **4-Tier Assessment Semantics & Transactional Persistence (`AC-02`):**
   - [`Portfolios::Generator`](file:///e:/New%20folder/ai-interview-platform/api/app/services/portfolios/generator.rb):
     - Filters `assessable_configured_maps` to `state IN ('partial', 'covered')` with `probe_count >= 2` (matching `Coverage::StateEngine` hard rules).
     - Excludes `not_yet` (`0` probes) and `initiated` (`1` probe) skills from LLM `configured_skills` scoring and prevents `nil` levels from being coerced via `.to_i.clamp(1, 5)` into `L1`.
     - Caps `ai_confidence` at `'medium'` when `coverage_map.state == 'partial'` or `probe_count < 3`.
     - Wraps `portfolio_skills.destroy_all`, `create!`, and `portfolio.update!(generation_status: 'complete')` in `ActiveRecord::Base.transaction`.
   - [`PortfoliosController#portfolio_json`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L208-L290):
     - Reconciles `session.assessment.assessment_skills.order(:display_order)` against `session.coverage_maps` and scored `portfolio_skills` to return `session_summary` (`configured_skills_count == assessed_skills_count + unassessed_skills_count`) and `unassessed_skills` (`reason: "not_probed" | "insufficient_evidence"`).
     - Orders `portfolio_skills` deterministically via `.order(:is_discovered, :id)`.
3. **Override Rationale Validation (`AC-04`, Assumption A-01):**
   - [`AssessorOverride`](file:///e:/New%20folder/ai-interview-platform/api/app/models/assessor_override.rb): Added `before_validation :normalize_assessor_notes` and `validates :assessor_notes, presence: true, length: { minimum: 5, maximum: 2000 }`.
4. **Fit/Gap Contract, Redis Job Deduplication, Legacy Compatibility & Freshness (`AC-06`, `AC-07`):**
   - [`FitGap::GenerationTracker`](file:///e:/New%20folder/ai-interview-platform/api/app/services/fit_gap/generation_tracker.rb): Redis atomic lock (`SET NX EX 90`) + worker execution guard (`SET NX EX 60`) + state key (`EX 300`) + `report_stale?(portfolio, report)` helper (`assessor_overrides.maximum(:overridden_at) > report.generated_at`).
   - [`FitGap::Engine`](file:///e:/New%20folder/ai-interview-platform/api/app/services/fit_gap/engine.rb): Emits `required_level`, `expected_level`, `candidate_level`, `ai_level`, `is_override`, `assessor_notes`, `assessment_status`, `result`, `delta`, and `confidence`, and includes `not_assessed` count in `generate_fallback_narrative`.
   - [`PortfoliosController#show_fitgap`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L145-L176): Distinguishes parent-resource `404` (`Portfolio` or `Vacancy` missing/unauthorized) from report status (`200 { status: "not_generated" }`, `202 { status: "generating" }`, `200 { status: "failed", error_code, message }`, `200 { status: "ready", report }`). Normalizes legacy `skill_comparisons` on read without destructive DB writes.
   - [`Exports::PdfGenerator`](file:///e:/New%20folder/ai-interview-platform/api/app/services/exports/pdf_generator.rb) & [`PortfoliosController#build_export_json`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L368-L388): Recomputes `skill_comparisons` synchronously when a report is stale after an override, and renders `Unassessed Configured Skills` in PDF exports.
5. **Sanitized Error Presentation (`AC-08`):**
   - [`PortfoliosController#sanitize_generation_error`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L353-L366): Maps internal exception strings to safe `error_code` (`ai_service_unavailable`, `ai_service_timeout`, `invalid_ai_response`) and a user-safe message while keeping raw exceptions in server logs.

### 2. Data Model Justification (Why No Migration Is Required)
- No schema migration is required because:
  1. `ai_interview.sessions` and `ai_interview.vacancies` already store `tenant_id BIGINT NOT NULL` with indexes (`idx_sessions_tenant_status`, `index_vacancies_on_tenant_id`), allowing explicit `INNER JOIN` tenant predicates on `portfolios` and `portfolio_skills`.
  2. `ai_interview.coverage_maps` (`state`, `probe_count`) and `ai_interview.assessment_skills` (`expected_level`, `display_order`) already persist all inputs required to compute `session_summary` and `unassessed_skills` (`not_probed` vs. `insufficient_evidence`).
  3. `ai_interview.assessor_overrides` already persists `ai_level`, `override_level`, `assessor_notes`, `overridden_by`, and `overridden_at`.
  4. `ai_interview.fit_gap_reports.skill_comparisons` is a `jsonb NOT NULL` column that stores the enriched comparison fields (`required_level`, `is_override`, `ai_level`, `assessor_notes`, `assessment_status`) while `PortfoliosController#normalize_comparison_entry` backfills legacy rows on read without destructive database rewrites.

### 3. Commands Executed & Verified Results
1. **Test Database Migration (`task-518`):**
   - Command: `RAILS_ENV=test bundle exec rails db:create db:migrate`
   - Result: Exited `0` (all 8 migrations applied cleanly to `rakamin_test`).
2. **Pre-Fix Regression Run (`task-527`, `task-533`):**
   - Command: `RAILS_ENV=test bundle exec rspec spec/requests/api/v1/evaluation_workflow_spec.rb --format documentation`
   - Result: Exited `1` (`8 examples, 8 failures` — confirmed each test failed specifically on the unpatched backend behavior: cross-tenant `200 OK` instead of `404`, `SK-ENG-003`/`SK-ENG-004` persisted as `L1` rows, blank `assessor_notes` returning `201`, `GET /fitgap/:vacancy_id` returning `404` instead of `200 not_generated`, `required_level` nil, and raw `Faraday::ConnectionFailed` secret leaked).
3. **Post-Fix RSpec Verification (`task-577`):**
   - Command: `RAILS_ENV=test bundle exec rspec spec/requests/api/v1/evaluation_workflow_spec.rb --format documentation`
   - Result: Exited `0` (`10 examples, 0 failures` in `4.75s`).

---

## Stage 5B: Frontend Implementation (Declared Depth: `FRONTEND-HEAVY`)

### 1. Component Architecture & Responsibilities
1. **Type-Safe API Contracts ([`web/src/types/index.ts`](file:///e:/New%20folder/ai-interview-platform/web/src/types/index.ts), [`web/src/services/sessions.ts`](file:///e:/New%20folder/ai-interview-platform/web/src/services/sessions.ts), [`web/src/services/portfolios.ts`](file:///e:/New%20folder/ai-interview-platform/web/src/services/portfolios.ts)):**
   - Replaced untyped `as any` casts with explicit interfaces: `SessionSummary`, `UnassessedSkill`, `PortfolioApiResponse`, `FitGapStatus`, and `FitGapStatusResponse`.
   - Aligned `SkillComparison` with the Stage 5A backend contract (`required_level`, `expected_level`, `candidate_level`, `ai_level`, `is_override`, `assessor_notes`, `assessment_status`, `result`, `delta`, `confidence`).
2. **Session Coverage Context ([`web/src/components/portfolio/SessionCoverageBanner.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SessionCoverageBanner.tsx)):**
   - Renders the interview session's end reason badge (`All Skills Covered`, `Ended Early by Candidate`, `Ended by Assessor`, `Time Limit Reached`, `Interrupted by Error`), formatted duration (`mm ss`), accessible progress bar (`role="progressbar"`, `aria-valuenow`, `aria-valuemax`), and assessed vs. unassessed skill counts so assessors immediately see whether a session was cut short.
3. **4-Tier Unassessed Skill Presentation ([`web/src/components/portfolio/UnassessedSkillsSection.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/UnassessedSkillsSection.tsx)):**
   - Explicitly separates unassessed configured skills from scored skills and distinguishes **Not Probed (0 probes)** (`reason: "not_probed"`) from **Insufficient Evidence (1 probe)** (`reason: "insufficient_evidence"`) alongside each skill's target `expected_level` (`L1–L5`).
4. **Accessible Override Interaction & Provenance ([`web/src/components/assessment/LevelRadio.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/assessment/LevelRadio.tsx), [`web/src/components/portfolio/OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx), [`web/src/components/portfolio/SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx)):**
   - Fixed global DOM `id` collisions in `LevelRadio` using `React.useId()` so multiple override panels on the same page have unique radio input/label bindings (`${groupId}-l${lvl}`).
   - Added focus management (focus moves to rationale textarea on open and returns to trigger button on close/save), `Escape` key dismissal, in-flight `saving` locks, minimum 5-character rationale validation (`role="alert"`, `aria-invalid`, `aria-describedby`), and preservation of typed notes on network/API failure.
   - Added the **Latest Assessor Override** block on `SkillPortfolioCard` showing `AI Lx → Assessor Ly`, timestamp, and full `assessor_notes` (`break-words`), plus clear distinction between verbatim interview quotes and AI competency summaries.
5. **Truthful Fit/Gap Comparison & Dual Narratives ([`web/src/components/fitgap/ComparisonTable.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx), [`web/src/pages/fitgap/FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx)):**
   - `ComparisonTable` resolves `c.required_level ?? c.expected_level` for the **Required** column, displays `✏` override badge + `AI Lx → Ly` + inline `Override note` when `is_override` is true, distinguishes `Insufficient evidence` vs. `Not probed` for `not_assessed` rows, and displays all four summary counts (`Match`, `Exceeds`, `Gap`, `Not assessed`).
   - `FitGapReportPage` renders **Overall Hiring Recommendation** (`overall_narrative`) and **Culture & Competency Fit** (`culture_narrative`) in separate cards so neither narrative masks the other.
6. **Deterministic Async State Machines ([`web/src/pages/portfolio/PortfolioPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/portfolio/PortfolioPage.tsx), [`web/src/pages/fitgap/FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx)):**
   - Guarded async responses with `latestRequestIdRef` to prevent out-of-order response overwrites.
   - Treated `404` on `GET /fitgap/:vacancyId` as a terminal `not_found` state and never auto-triggered `POST /fitgap` on `404`.
   - Triggered `POST /fitgap` at most once per `(portfolioId, vacancyId)` via `hasTriggeredRef` when `status === "not_generated"`.
   - Added bounded polling (`MAX_POLL_ATTEMPTS = 12` / 60s) with a `timeout` state offering **Check Status** (`GET` without duplicate `POST`) vs. **Restart Generation** (`POST`).

### 2. Commands Executed & Verified Results
1. **Frontend Unit & Integration Test Suite (`task-687`):**
   - Command: `npm test` (`vitest run`)
   - Result: Exited `0` (`1 test file passed, 9 tests passed in 7.62s`).
2. **TypeScript & Vite Production Build (`task-694`):**
   - Command: `npm run build` (`tsc && vite build`)
   - Result: Exited `0` (`1843 modules transformed, built in 22.10s` with zero TypeScript errors).

---

## Stage 5C: Verification and Evidence Collection (Declared Depth: `FRONTEND-HEAVY`)

### 1. Acceptance-Criteria Verification Matrix

| Criterion | Verification Method | Evidence | Status |
| :--- | :--- | :--- | :--- |
| **AC-01: Cross-Tenant Isolation & Zero Side Effects** | RSpec request specs + live E2E HTTP (`task-718`, `task-818`) | [`evaluation_workflow_spec.rb`](file:///e:/New%20folder/ai-interview-platform/api/spec/requests/api/v1/evaluation_workflow_spec.rb#L1-L150) (`3 examples, 0 failures`) & `[E2E-4] GET with mismatched X-Tenant-Scheme => HTTP 403 {"errors":[{"status":403,"message":"Unauthorized request"}]}`. Verified zero `AssessorOverride` rows created and zero `FitGapGeneratorWorker` jobs enqueued on cross-tenant requests. | **PASS** |
| **AC-02: 4-Tier Assessment Semantics (`not_probed`, `insufficient_evidence`, `partial`, `covered`)** | RSpec request specs + live E2E HTTP + Vitest (`task-718`, `task-818`, `task-827`) | `[E2E-1] GET /sessions/7/portfolio => HTTP 200, configured=4, assessed=2, unassessed=2, reasons=["Incident Management:insufficient_evidence(1)", "Cloud Security:not_probed(0)"]`; [`PortfolioPage`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/portfolio/PortfolioPage.tsx) & [`UnassessedSkillsSection`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/UnassessedSkillsSection.tsx) Vitest suite (`renders SessionCoverageBanner, assessed skills, and UnassessedSkillsSection distinguishing not_probed vs insufficient_evidence`). | **PASS** |
| **AC-03: Session Coverage Context Banner** | Vitest behavioral test + component inspection (`task-827`) | [`SessionCoverageBanner.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SessionCoverageBanner.tsx) renders `2 of 4 configured skills assessed`, `Ended Early by Candidate`, `2m 0s`, and `role="progressbar"` (`aria-valuenow="2"`, `aria-valuemax="4"`). | **PASS** |
| **AC-04: Assessor Override Rationale Validation ($\ge 5$ chars) & Provenance** | RSpec + live E2E HTTP + Vitest (`task-718`, `task-818`, `task-827`) | `[E2E-2a] POST /portfolio_skills/11/override (short note) => HTTP 422 {"errors":[{"status":422,"message":"Assessor notes is too short (minimum is 5 characters)"}]}`; `[E2E-2b] (valid note) => HTTP 201, db_override_level=4`. Frontend [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx) enforces client validation (`role="alert"`), preserves user input on failure, parses Rails `errors: [{ status, message }]` payloads, and [`SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx) renders `Latest Assessor Override: AI L2 → Assessor L4`. | **PASS** |
| **AC-05: Accessible Radio Group (`useId`) & Keyboard Focus Management** | Vitest behavioral test (`task-827`) | [`LevelRadio.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/assessment/LevelRadio.tsx) generates unique DOM `id`s (`new Set(ids).size === ids.length` across multiple simultaneous override panels). [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx) moves focus to rationale textarea on open, closes on `Escape`, and restores focus to trigger button. | **PASS** |
| **AC-06: Fit/Gap Contract (`404` vs `not_generated` vs `generating` vs `failed` vs `ready`) & Deduplication** | RSpec + live E2E HTTP + Vitest + Seeded Fault Test (`task-718`, `task-818`, `task-842`) | `[E2E-3a] GET /portfolios/7/fitgap/6 (before report) => HTTP 200 {"status":"not_generated","report":null}`; `[E2E-3b] GET /portfolios/7/fitgap/999999 (missing parent vacancy) => HTTP 404`. [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx) treats `404` as terminal `not_found` without calling `triggerFitGap` (`POST /fitgap`), and calls `triggerFitGap` at most once per `(portfolioId, vacancyId)` on `not_generated`. | **PASS** |
| **AC-07: Fit/Gap Table Columns (`Required`, Override Provenance, `Not assessed`) & Dual Narratives** | RSpec + live E2E HTTP + Vitest (`task-718`, `task-818`, `task-827`) | `[E2E-3c] comparisons=["Cloud Security:req=4,cand=,override=false,result=not_assessed,status=not_probed", "Incident Management:req=3,cand=,override=false,result=not_assessed,status=insufficient_evidence", "System Design:req=3,cand=4,override=true,result=exceed,status=covered"]`. [`ComparisonTable.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx) renders `Required` (`L1–L5`), `AI L2 → L4` + `Override note`, `Insufficient evidence` vs `Not probed`, and all 4 summary counts. [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx) renders separate **Overall Hiring Recommendation** and **Culture & Competency Fit** cards. | **PASS** |
| **AC-08: Sanitized Error Presentation & Bounded Polling Recovery** | RSpec + Vitest (`task-718`, `task-827`) | [`PortfoliosController#sanitize_generation_error`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L353-L366) strips internal class/URL/key details; [`PortfolioPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/portfolio/PortfolioPage.tsx) and [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx) display sanitized `role="alert"` banners with **Retry Generation** and pause polling after `MAX_POLL_ATTEMPTS = 12` with **Check Status** (`GET`) vs **Restart Generation** (`POST`). | **PASS** |

---

### 2. End-to-End Integration Bug Caught & Fixed in Stage 5C
- **Finding during Live HTTP Verification (`task-792`):**
  - When testing `POST /api/v1/portfolio_skills/:id/override` with a 2-character note (`"ok"`) against the live Rails server (`127.0.0.1:3001`), `ApiController#json_error` returned:
    ```json
    {"errors":[{"status":422,"message":"Assessor notes is too short (minimum is 5 characters)"}]}
    ```
  - In Stage 5B, `OverridePanel.tsx` had typed `errData.errors` as `string[]` (`const serverMsg = errData?.error ?? errData?.errors?.[0]`), which would have stringified the object `{ status: 422, message: "..." }` as `"[object Object]"` when interpolated into the error banner!
- **Fix Applied (`031cdb4`):**
  - Updated [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx#L106-L125) to inspect `typeof firstErr === "string" ? firstErr : firstErr?.message` and updated [`evaluationWorkflow.test.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/__tests__/evaluationWorkflow.test.tsx#L273-L284) to mock the exact Rails `errors: [{ status: 422, message: "..." }]` payload.

---

### 3. Seeded Fault Proof
- **Protected Frontend Rule Selected:**
  - `FitGapReportPage` must treat HTTP `404` on `GET /api/v1/portfolios/:id/fitgap/:vacancyId` as a terminal `not_found` state and must **never** auto-trigger `POST /api/v1/portfolios/:id/fitgap` (`portfoliosApi.triggerFitGap`) when `GET` returns `404`.
- **Procedure & Recorded Git Artifacts:**
  1. **Clean Baseline Commit on Submission Branch:**
     - Branch: `feature/case-study-fullstack-irfan-aprilyana`
     - Commit SHA: `9ccdb66` (`chore: ignore Redis dump.rdb in root .gitignore`)
     - Pre-Fault Test Run (`task-935`): `npm test` -> `10 passed (10)` in `4228ms`.
  2. **Scratch Branch Created:**
     - Branch: `scratch/seeded-fault-test-irfan-aprilyana`
  3. **Intentional Fault Seeded & Committed:**
     - Commit SHA: `c935c2b` (`test(fault): seed intentional 404 auto-trigger fault in FitGapReportPage`)
     - Change in [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx#L120-L125): Replaced `setNotFoundError(...)` in the `if (status === 404)` catch block with `await portfoliosApi.triggerFitGap(portfolio.id, targetVacancyId).catch(() => {}); setGenerating(true);`.
  4. **Fault Test Execution & Captured Failure (`task-947`):**
     - Command: `npm test` (`vitest run`)
     - Actual Output:
       ```text
       FAIL src/__tests__/evaluationWorkflow.test.tsx > Evaluation Workflow — Stage 5B Frontend Verification > FitGapReportPage & ComparisonTable — Status Contract, Narratives & Table Columns > treats HTTP 404 from getFitGap as terminal not_found and never calls triggerFitGap
       TestingLibraryElementError: Unable to find role="alert"
        ❯ src/__tests__/evaluationWorkflow.test.tsx:360:34
           360|       const alert = await screen.findByRole("alert");
           361|       expect(alert).toHaveTextContent(/not found in your workspace/i);
           362|       expect(portfoliosApi.triggerFitGap).not.toHaveBeenCalled();

       Test Files  1 failed (1)
            Tests  1 failed | 9 passed (10)
           Errors  1 error
       ```
  5. **Revert Commit on Scratch Branch & Recovery (`task-953`):**
     - Revert Commit SHA: `f8f5ab5` (`Revert "test(fault): seed intentional 404 auto-trigger fault in FitGapReportPage"`)
     - Post-Revert Test Run (`task-953`):
       ```text
       ✓ src/__tests__/evaluationWorkflow.test.tsx (10 tests) 2834ms
       Test Files  1 passed (1)
            Tests  10 passed (10)
         Duration  9.02s
       ```
  6. **Returned to Clean Submission Branch:**
     - Checked out `feature/case-study-fullstack-irfan-aprilyana` (`9ccdb66`); scratch branch was kept isolated and never merged into the submission branch.

---

### 4. Genuine AI Verification Moment
- **Context & Stage:** Stage 5B / Stage 5C Frontend-to-Backend Error Contract Integration (`OverridePanel.tsx` & `FitGapReportPage.tsx`).
- **Original AI Suggestion / Assumption:**
  1. During initial Stage 5B implementation (`task-659`), the AI assumed `PortfoliosController#show_fitgap` returned `{ status: "failed", error: "..." }` (matching `PortfoliosController#show`), and assumed Rails validation errors in `PortfolioSkillsController#override` returned `{ errors: ["..."] }` (an array of plain strings).
- **Risk / Consequence if Unchecked:**
  1. On `FitGapReportPage`, reading `data.error` instead of `data.message` caused the UI to ignore the backend's sanitized failure message (`"The AI evaluation service timed out..."`) and fall back to a generic string.
  2. On `OverridePanel`, `ApiController#json_error` actually wraps errors as `{"errors": [{"status": 422, "message": "Assessor notes is too short (minimum is 5 characters)"}]}`. Interpolating `errData.errors[0]` directly as a string would render `"[object Object] (Your changes have been preserved.)"` to the assessor.
- **Independent Verification:**
  - Inspected [`PortfoliosController#show_fitgap`](file:///e:/New%20folder/ai-interview-platform/api/app/controllers/api/v1/portfolios_controller.rb#L158-L164) and executed live HTTP `POST /api/v1/portfolio_skills/:id/override` against `http://127.0.0.1:3001` (`task-792` / `task-818`), capturing the raw JSON response body `{"errors":[{"status":422,"message":"Assessor notes is too short (minimum is 5 characters)"}]}`.
- **Correction & Supporting Evidence:**
  - Updated [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx#L58-L65) to read `data.message`, updated [`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx#L106-L125) to extract `typeof firstErr === "string" ? firstErr : firstErr?.message`, and locked both behaviors down with Vitest assertions in [`evaluationWorkflow.test.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/__tests__/evaluationWorkflow.test.tsx) (`task-827`).

---

### 5. Visual UI/UX & Design Alignment (`FRONTEND-HEAVY` Reference Polish)
- **Visual Direction & Palette System (Clean, Compact Assessment Workspace):**
  - **Surfaces & Palette:** Workspace background `#F7F9FA`, white card surface `#FFFFFF`, primary teal accent `#0F8F95` (hover `#0B7479`), dark typography `#1F2937`, muted metadata `#64748B`, and subtle borders `#E2E8F0`.
  - **Main Container Width:** Centered main content with a `max-w-[1200px] mx-auto` container, `16px` mobile gutters (`px-4`), and `24–32px` desktop gutters (`sm:px-6 lg:px-8`).
  - **Card Geometry & Spacing:** Subtle border (`border-[#E2E8F0]`) over heavy shadows, rounded corners `10px` (`rounded-[10px]`), and comfortable padding (`p-4 sm:p-5`).
  - **Reduced Motion Support:** Added global `@media (prefers-reduced-motion: reduce)` in `index.css` to respect accessibility preferences.
- **PortfolioPage Reading Order & Layout Upgrades ([`PortfolioPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/portfolio/PortfolioPage.tsx)):**
  - Enforced the exact 6-step reading order:
    1. **Navigation/Breadcrumb:** Back link (`/assessments/${id}/invite`) + breadcrumb context.
    2. **Candidate & Assessment Title:** Prominent page heading (`text-[22px] sm:text-[28px] font-bold text-[#1F2937]`) with candidate name, assessment name, and session metadata.
    3. **Primary & Secondary Actions:** Elevated the primary Vacancy Fit/Gap selection toolbar (`Choose target vacancy...` + `Run Fit/Gap Analysis →`) into the top header card alongside secondary export actions (`Transcript`, `PDF`, `JSON`), making the primary action immediately discoverable.
    4. **Compact Session-Completeness Summary:** [`SessionCoverageBanner.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SessionCoverageBanner.tsx) on a clean white card surface with amber warning only for incomplete sessions and teal progress bar.
    5. **Skill Assessment Content:** [`SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx) in an `items-start` responsive grid (`grid grid-cols-1 lg:grid-cols-2 gap-4 items-start`), preventing equal-height cards from creating large empty areas.
    6. **Clearly Separated Unassessed Information:** [`UnassessedSkillsSection.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/UnassessedSkillsSection.tsx) in a 2-column grid of compact white dashed cards.
- **Skill Card Structure & Subtle Inset Evidence ([`SkillPortfolioCard.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/SkillPortfolioCard.tsx)):**
  - Aligned skill name (`16px font-semibold`) and effective rating (`LevelBadge`) coherently on the card header row.
  - Placed supporting metadata (`Covered`, `ConfidenceIndicator`, `AI-generated` / `Human override active`) cleanly beneath the heading (`12–13px`).
  - Formatted supporting verbatim quotes into a subtle inset box (`bg-[#F7F9FA] border border-[#E2E8F0] rounded-lg px-3.5 py-2.5`) with a subtle quote icon.
  - Separated the override form/action with a subtle dashed divider (`border-t border-dashed border-[#E2E8F0]`).
- **Override Form Clean Alignment ([`OverridePanel.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/portfolio/OverridePanel.tsx), [`LevelRadio.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/assessment/LevelRadio.tsx)):**
  - Replaced Unicode symbol icons with Lucide icons (`CheckCircle2`, `ArrowRight`).
  - Rendered open form in an inset panel with concise guidance, `#0F8F95` radio card selection, character counter, inline validation alert, secondary `Cancel`, and primary `Save override` button.
- **Fit/Gap Report & Comparison Table Polish ([`ComparisonTable.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx), [`FitGapReportPage.tsx`](file:///e:/New%20folder/ai-interview-platform/web/src/pages/fitgap/FitGapReportPage.tsx)):**
  - Replaced all emojis (`✅`, `⭐`, `⚠`, `✏`) with Lucide icons (`CheckCircle2`, `TrendingUp`, `AlertTriangle`, `Minus`, `Pencil`).
  - Presented summary counts in a compact, wrapping row of clean chips rather than oversized banners.
  - Made [`ComparisonTable`](file:///e:/New%20folder/ai-interview-platform/web/src/components/fitgap/ComparisonTable.tsx) the main detailed evidence area directly below the header card.
  - Table styling: muted table header (`bg-[#F7F9FA] text-[#64748B]`), subtle row separators (`divide-y divide-[#E2E8F0]`), left-aligned descriptive text, and consistent column alignments.
  - Presented **Overall Hiring Recommendation** and **Culture & Competency Fit** in separate readable sections below the table.
- **Verified Results:**
  - `npm test`: **`15 passed (15)`** across all unit and integration tests.
  - `npm run build`: `tsc && vite build` succeeded in `10.67s` with zero errors.

---

### 6. Screenshot Status, Manual Viewport Checklist & Known Limitations
1. **Visual Screenshot Verification Status (`PENDING` — Browser Tool Unavailable in CLI Environment):**
   - Baseline screenshot artifact from initial discovery: `media_1792345944493_d302e1d0.png` (located in the conversation brain artifact directory).
   - Because automated browser screenshot tools are unavailable in this terminal-only session, live screenshot capture of the final UI is marked **pending manual capture** prior to final portal submission.
   - **Precise Manual Visual Verification Checklist (`375px`, `768px`, `1440px`):**
     - **At `375px` (Mobile):** Open `/assessments/:id/sessions/:sessionId/portfolio` and `/fitgap/:vacancyId`. Verify zero page-level horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth`), natural wrapping of header actions and top toolbar, `2-column` `LevelRadio` grid inside an open `OverridePanel`, and contained horizontal scroll inside `ComparisonTable` (`overflow-x-auto`).
     - **At `768px` (Tablet):** Open `OverridePanel` on any `SkillPortfolioCard` and confirm the full-width card footer keeps the skill title and `LevelBadge` uncompressed at the top of the card.
     - **At `1440px` (Desktop):** Verify `max-w-[1200px]` container alignment between header and main content, `5-column` `LevelRadio` pills, and side-by-side `lg:grid-cols-2` rendering of assessed skill cards and narrative cards.
2. **Polling Timeout Real-Clock Duration:** Bounded polling (`MAX_POLL_ATTEMPTS = 12` at 5-second intervals = 60 seconds) is implemented in `PortfolioPage` and `FitGapReportPage`, while unit tests verify immediate state transitions without real-clock 60s delays.
3. **Legacy Unscoped Tables Outside Selected Workflow:** Tenant isolation was enforced across `ApplicationController`, `PortfoliosController`, `PortfolioSkillsController`, and `FitGapGeneratorWorker`. Other controllers outside the post-interview evaluation workflow were intentionally left untouched to keep the backend diff focused on the selected scope.


