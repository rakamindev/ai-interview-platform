# 04. Revamp Strategy, Acceptance Criteria and Trade-offs

Step 4 of the case study. Design only: no code, migrations, commits or pushes. Inputs: `03-problems-and-gaps.md` (findings and scope line), `02-context-and-domain.md`, product decisions Q1 to Q5, wiki PRD-01/PRD-02, and the current code (re-read for this step: `db/schema.rb`, `Portfolios::Generator`, `FitGap::Engine`, `Exports::PdfGenerator`, both portfolio controllers, the worker, `PortfolioPage`, `FitGapReportPage`, `ComparisonTable`, `SkillPortfolioCard`, `OverridePanel`, `LevelBadge`, `ConfidenceIndicator`, `usePolling`, `components/ui/*`).

Finding IDs (A1, B2, ...) refer to `03-problems-and-gaps.md`.

---

## 1. Revamp in one paragraph

The revamp makes the Portfolio, Override and Fit/Gap flow say only what the evidence supports, and makes the human decision durable and visible. **Assessors** see "Not assessed" instead of invented L1 ratings, confidence computed from how much a skill was actually probed, and corrections that survive regeneration with a required reason, full history and an undo. **Recruiters** get a fit/gap view that never counts unmeasured or thin-evidence skills as gaps, lists them as "probe in the next interview", shows the required level and who set each level, and reports clearly when it is generating, failed or out of date instead of spinning forever. **Hiring managers** receive a PDF that is the same document as the screen: same states, same override trail, narrative labelled as AI generated, and it no longer crashes on corrected portfolios or non-Latin text. **Candidates** are no longer marked down for skills nobody asked about, their record can only be seen and changed by the organisation that interviewed them, and every rating that affects them carries a visible human review, which is the basis for UU PDP Pasal 10.

---

## 2. Prioritised scope and dependency order

### Tiers

| Tier | Findings | Why this tier |
|---|---|---|
| **Must** | C1, A1, A2, B1, B4, D3, A3 (confidence data only), A4, F1, B3, D1, D2, A6, B6, B2 | Without these the revamp still fabricates ratings, loses human decisions, leaks across tenants, or cannot produce the official PDF. A2 and D3 moved up from the initial "Should" list because A1 cannot be fixed safely without schema validation and a transaction (the same `save_skills` code). A6 and B6 moved up because the chosen fit/gap design (D-3) removes them as a side effect at no extra cost. |
| **Should** | A3 (UI part), A5, B5, C3 | Make the result honest end to end (confidence on screen, narrative provenance, PDF parity, no raw errors). B5 is mostly delivered by the shared presenter (D-5). |
| **Could** | F2, F3, D4, D5, D6 | Polish and robustness. D6 is largely covered by D-3; only the explicit concurrency test is "Could". |

Out of scope (per `03` section 8): C2, C4, E1 to E4, G1 to G4, A7.

### Dependency order

```
1. C1 tenant scoping (independent; ships first, smallest, highest risk)
2. D-1 data: nullable level + rating_status (+ legacy flag)        <- needed by everything below
3. D-7 confidence snapshot from coverage (same migration as 2)
4. A2/D3 validated, transactional generator writing statuses       <- needs 2, 3
5. D-2 stable skill identity + override history + required note   <- needs 4 (no destroy_all)
6. D-3 fit/gap computed on read + narrative lifecycle             <- needs 2, 5 (is_override, not assessed)
7. D-5 shared presenter (portfolio skill + fit/gap view model)    <- needs 5, 6
8. D-6 PDF from presenter + bundled font                          <- needs 7
9. Web: types, Portfolio page, Override dialog, Fit/Gap page      <- needs 7 (contract), can start in parallel against fixtures
```

---

## 3. Design decisions

Scales: impact and cost are relative to this codebase and deadline. "Reversible" means the migration and code can be rolled back cheaply.

### D-1 Representing "not assessed"

| Option | Impact | Cost | Maintainability | Reversibility | Failure modes | Fit |
|---|---|---|---|---|---|---|
| **A. `ai_level` nullable + `rating_status` (`assessed` / `not_assessed`) + `not_assessed_reason`** | High: explicit state everywhere, reasons auditable | Medium: one migration, constraint swap | Readable; every consumer checks one field | Down migration possible if no NULL rows (fails loudly otherwise) | Consumer forgets the status check: mitigated by presenter (D-5) being the only reader | Matches PRD-01 "assign the level from evidence"; small diff |
| B. Sentinel `ai_level = 0` | Medium | Low | Poor: 0 silently enters arithmetic (delta = 0 - 3) | Easy | Any missed check produces a fake "Gap -3": the same bug class we are fixing | Rejected |
| C. Separate `skill_assessments` table (one row per rating attempt) | High, full audit | High: new model, joins everywhere | Good long term | Medium | More moving parts for the deadline | Rejected for now; noted as follow-up if multiple raters arrive |

**Recommendation: A.** Rules: a level is stored only when (1) the coverage state for that skill is `partial` or `covered`, (2) the model returned an integer 1 to 5, and (3) at least one evidence quote exists ("no evidence, no level"). Otherwise `ai_level = NULL`, `rating_status = not_assessed`, reason one of `not_covered`, `no_level_from_model`, `invalid_level_from_model`, `no_evidence`. The CHECK becomes `ai_level IS NULL OR ai_level BETWEEN 1 AND 5`.

**Prompt N10 (wiki conflict).** The prompt is changed to (a) list only skills whose coverage state is `partial` or `covered` for rating, (b) allow `"level": null` with `"reason"`, (c) never guess. Rule (1) is enforced in code as well, so a model that ignores the prompt cannot reintroduce the bug. The wiki itself is not editable by us; the change is documented in the PR.

### D-2 Overrides that survive regeneration, with history

| Option | Impact | Cost | Maintainability | Reversibility | Failure modes | Fit |
|---|---|---|---|---|---|---|
| **A. Stable skill identity (`skill_key`, unique per portfolio) + upsert instead of `destroy_all`; keep `assessor_overrides` as current state; new append-only `assessor_override_events` table** | High: overrides persist, history complete, revert possible | Medium | Clear: current state for reads, events for audit | Additive tables/columns, easy down | Skill renamed by model: key falls back to `skill_id` first, label second; unmatched old skill is kept as `not_assessed` rather than deleted, so the override is never orphaned | Small change to existing models |
| B. Portfolio versioning (new portfolio per generation, overrides copied forward) | High audit | High: unique `session_id` index, every query must pick "latest", copy logic | Heavier | Medium | Copy step fails, version confusion | Rejected: too invasive for the flow |
| C. Soft-delete skills and re-attach overrides by label | Medium | Medium | Ghost rows, matching heuristics | Easy | Silent mis-attachment on label drift | Rejected |

**Recommendation: A.**
- `skill_key` = `skill_id` when present, else normalised label (`lower`, trimmed, collapsed spaces); unique index `(portfolio_id, is_discovered, skill_key)`.
- Regeneration runs in one transaction: upsert returned skills; skills not returned are set to `not_assessed` (reason `not_covered`) but kept, with their override.
- Every override change writes an event: `set` (from_level, to_level, note) or `revert` (note). Note required for both (Q2). `ai_level_at_time` captured on every event, not only on create.
- Override on a `not_assessed` skill is allowed (from NULL); it then counts as an assessor rating.
- Same level as the current effective level is rejected with 422 ("no change"); see decision 11.2.
- Optimistic locking (`lock_version`) on the current override row gives a 409 instead of lost updates.

### D-3 Fit/gap report lifecycle

| Option | Impact | Cost | Maintainability | Reversibility | Failure modes | Fit |
|---|---|---|---|---|---|---|
| A. Keep cached report; add `status`, `stale_at`, `error_code`; idempotent job | High | Medium-high: staleness must be triggered from every write path | Fragile: every new write path must remember to mark stale | Easy | Missed invalidation keeps A6 alive | Possible |
| **B. Compute comparisons on read (pure function of current portfolio, overrides, vacancy); only the AI narrative is async, stored with `status`, `input_digest`, `narrative_source`, `error_code`** | High: table can never be stale, no 404 while generating, overrides visible instantly | Medium | Simple: one pure function, one small state machine | Easy | Narrative outdated: detected by digest mismatch and shown as "outdated" | Matches existing rule-based engine; removes #7, #9, #16 by design |
| C. Version/hash every input and regenerate whole report on mismatch | High | High | Complex | Medium | Hash drift bugs | Rejected |

**Recommendation: B.**
- `GET /portfolios/:id/fitgap/:vacancy_id` always returns 200 when the portfolio is complete: computed comparisons plus `narrative.status` (`not_requested`, `generating`, `complete`, `failed`, `outdated`).
- `POST` requests a narrative only. Idempotency: `INSERT ... ON CONFLICT (portfolio_id, vacancy_id) DO NOTHING`, then an atomic claim `UPDATE ... SET status = 'generating' WHERE status IN ('not_requested','failed','outdated')`; only the request that wins the claim enqueues. A second POST while generating returns 202 without a new job. This also removes the `RecordNotUnique` race (D6).
- The worker re-checks the claim, computes the digest of the inputs it used, and stores it. If inputs changed meanwhile, the result is stored as `outdated`.
- Front end polls GET only (never POST) and stops on `complete`, `failed` or `outdated`.
- Overrides no longer delete reports (B6); they only change the digest, so the narrative shows "outdated".

### D-4 Tenant isolation

| Option | Impact | Cost | Maintainability | Reversibility | Failure modes | Fit |
|---|---|---|---|---|---|---|
| **A. Explicit scope through `sessions.tenant_id` (`Portfolio.for_tenant(id)`, `PortfolioSkill.for_tenant(id)`) used by every touched endpoint; worker asserts portfolio and vacancy share a tenant** | Closes C1 now | Low | Needs discipline; guarded by request specs per endpoint | Trivial | A new endpoint forgets the scope: request spec template + review checklist | Uses existing `Session` tenancy; no migration |
| B. Denormalise `tenant_id` onto portfolios, portfolio_skills, fit_gap_reports and include `TenantScoped` | Strongest default | Medium: migration + backfill + workers outside request context need explicit tenant | Good | Medium | Default scope surprises in workers (the existing `Vacancy.unscoped` pattern) | Recommended follow-up (memo) |
| C. Central policy layer (e.g. Pundit) | Good | Medium plus a new gem | Good | Medium | New dependency, needs approval | Rejected for this deadline |

**Recommendation: A**, with B written into the Tech Lead memo as the durable fix. Cross-tenant requests return **404** (not 403) so existence is not disclosed.

### D-5 Payload contract (API, web, PDF)

| Option | Impact | Cost | Maintainability | Reversibility | Failure modes | Fit |
|---|---|---|---|---|---|---|
| **A. One presenter per concept (`Portfolios::SkillPresenter`, `FitGap::ReportPresenter`) producing a plain view model used by both JSON and PDF; TypeScript types mirror it; a shared JSON fixture checked by an RSpec request spec and a Vitest type/render test** | Fixes the seam root cause | Medium | One place to change | Easy | Presenter grows too big: split by concept | Two renderers today diverge (web vs Prawn) |
| B. Fix field names one by one (`required_level`, `is_override`) | Low | Low | Drift returns | Easy | Next field repeats the bug | Rejected |

**Recommendation: A.** The API keeps `expected_level` (it matches the database and the PDF); the web type changes to read it. No external API consumers are known `[Assumption]`; the JSON export gains `schema_version: 2`.

### D-6 PDF

| Option | Impact | Cost | Maintainability | Reversibility | Failure modes | Fit |
|---|---|---|---|---|---|---|
| **A. Bundle a TTF family (Noto Sans regular/bold, SIL OFL) and render from the presenter view model** | Fixes N12 and any non-Latin evidence text; PDF matches screen | Low-medium: about 1 MB of font files `[estimate]` | Single source of truth | Easy | Glyphs outside Noto Sans (emoji, Javanese script) render as missing boxes but do not crash; covered by a fallback-font test | Prawn already supports TTF |
| B. Replace problem characters ("→" to "->") | Low | Very low | Whack-a-mole | Easy | Any candidate quote with an unsupported character still crashes the export | Rejected |
| C. HTML-to-PDF (wkhtmltopdf/Chromium) | High fidelity | High: new system dependency | Heavy | Medium | Container/runtime issues | Rejected |

**Recommendation: A.** Unsupported glyphs are replaced by the font's missing-glyph box, never an exception; export failures return a safe 422/500 JSON message.

### D-7 Confidence

| Option | Impact | Cost | Maintainability | Reversibility | Failure modes | Fit |
|---|---|---|---|---|---|---|
| **A. Deterministic from the coverage map per PRD-01 §5 (high: probe_count >= 3 and covered; medium: probe_count = 2 or partial; low: otherwise), snapshot `coverage_state` and `probe_count` onto the portfolio skill at generation** | Calibrated, explainable in a tooltip | Low | Rule in one function | Easy | Coverage analyzer (also an LLM) miscounts probes: still auditable from the transcript | Implements the wiki as written |
| B. Keep model-reported confidence, validate the enum | Low | Low | Simple | Easy | Model self-confidence is overconfident (Xiong et al. 2024) | Rejected |

**Recommendation: A.** Confidence is `NULL` for not-assessed skills and is never shown next to an assessor level (fixes N1).

### D-8 Narrative provenance and fallback

| Option | Impact | Cost | Maintainability | Reversibility | Failure modes | Fit |
|---|---|---|---|---|---|---|
| **A. Remove the template "fallback narrative". Show a deterministic "System summary" (counts computed by the presenter, including not assessed and low confidence) always; the AI narrative is a separate, optional section with `narrative_source = ai` and label "AI generated, not a hiring decision"; when it fails, show the failure and a retry** | Removes text that impersonates analysis | Low | Simple | Easy | None new | Fits Q1 and Q4 |
| B. Keep fallback, add `narrative_source = fallback` label | Medium | Low | Two kinds of narrative to explain | Easy | Fallback still omits not assessed unless rewritten | Rejected |
| C. Label only, no data change | Low | Very low | Weak | Easy | Cannot tell fallback from AI in stored data | Rejected |

**Recommendation: A.** Existing stored fallback texts are migrated to `narrative_source = legacy_fallback` and hidden behind the system summary (D-8 backfill below).

---

## 4. Data model and migration plan

All migrations are separate, reversible files (`up`/`down`), no table rewrites of large tables `[Assumption: volumes are small]`, tested `db:migrate`, `db:rollback`, `db:migrate`. String columns with CHECK constraints are used instead of new Postgres enum types, because they are easier to change and roll back.

### M1 `portfolio_skills` (D-1, D-2, D-7)
| Change | Detail |
|---|---|
| `ai_level` | drop NOT NULL; replace `chk_portfolio_skills_ai_level` with `ai_level IS NULL OR ai_level BETWEEN 1 AND 5` |
| `ai_confidence` | drop NOT NULL (NULL when not assessed) |
| `rating_status` | string, NOT NULL, default `'assessed'`, CHECK in (`assessed`, `not_assessed`) |
| `not_assessed_reason` | string, NULL, CHECK in (`not_covered`, `no_level_from_model`, `invalid_level_from_model`, `no_evidence`) |
| `skill_key` | string(255); backfill `COALESCE(skill_id, lower(regexp_replace(trim(skill_label), '\s+', ' ', 'g')))`; then NOT NULL |
| unique index | `(portfolio_id, is_discovered, skill_key)`. Migration first checks for duplicates and aborts with a clear message if any exist (no silent dedupe) |
| `coverage_state`, `probe_count` | snapshot columns, NULL for legacy rows (backfilled from `coverage_maps` where a label or id match exists) |

Down: restore NOT NULL and the old CHECK **only if no NULL levels exist**; otherwise raise `ActiveRecord::IrreversibleMigration` with the count. Coercing back to L1 would recreate the bug.

### M2 `portfolios` (legacy flag, safe errors)
- `ratings_validated` boolean: add nullable, backfill `false` for every existing row, then default `true` and NOT NULL. Legacy portfolios show a banner: "Rated before validation. L1 and L5 ratings may be unmeasured skills; regenerate or review each rating." Levels are **not** changed silently, because a legacy L1 cannot be distinguished from a real one.
- `generation_error_code` string (`timeout`, `rate_limited`, `provider_denied`, `provider_unavailable`, `invalid_output`, `empty_output`, `unknown`). `generation_error` stays for operators but is no longer serialized.

### M3 override history (D-2)
- `assessor_override_events`: `id`, `portfolio_skill_id` (FK), `action` (`set`, `revert`), `from_level` (NULL allowed), `to_level` (NULL for revert), `ai_level_at_time` (NULL allowed), `notes` text NOT NULL, `actor_id` bigint NOT NULL, `created_at`. Index on `(portfolio_skill_id, created_at)`. Append-only: no update/destroy in the model.
- `assessor_overrides`: `ai_level` drop NOT NULL (override on not-assessed skill), CHECK `ai_level IS NULL OR 1..5`; add `lock_version` integer default 0; add CHECK `assessor_notes IS NOT NULL AND length(btrim(assessor_notes)) > 0` as `NOT VALID` so legacy rows without notes are tolerated but every new write is enforced.
- Backfill: one `set` event per existing override (`from_level = ai_level`, `to_level = override_level`, `actor_id = overridden_by`, `created_at = overridden_at`, `notes = assessor_notes` or the explicit marker `"[legacy override, no note recorded]"`). Nothing is deleted.
- Down: drop the events table (history is reconstructible from the current rows only for the latest state; documented).

### M4 `fit_gap_reports` (D-3, D-8)
- `status` string NOT NULL default `'not_requested'`, CHECK in (`not_requested`, `generating`, `complete`, `failed`, `outdated`)
- `narrative_source` string NULL, CHECK in (`ai`, `legacy_fallback`)
- `input_digest` string, `error_code` string, `requested_at`, `completed_at`
- `skill_comparisons` keeps its data as the snapshot the narrative was based on; drop NOT NULL (new rows store the snapshot at completion)
- Backfill: existing rows `status = 'complete'`; `narrative_source = 'legacy_fallback'` where `culture_narrative IS NULL AND overall_narrative LIKE 'Candidate shows %'`, else `'ai'`; `input_digest = NULL` (shown as "outdated, regenerate to refresh").
- Down: drop added columns, restore NOT NULL after filling any NULL snapshot with `'[]'`.

---

## 5. API contract

Base `/api/v1`. All endpoints scoped by tenant; another organisation's id returns **404** `{"errors":[{"status":404,"message":"Not found"}]}`.

### Portfolio skill (inside `GET /sessions/:id/portfolio`)
```json
{
  "id": 73,
  "skill_id": "sk-eng-001",
  "skill_label": "Ruby on Rails",
  "is_discovered": false,
  "rating_status": "assessed",
  "not_assessed_reason": null,
  "ai_level": 3,
  "confidence": "high",
  "coverage": { "state": "covered", "probe_count": 4 },
  "evidence": ["..."],
  "competency_summary": "...",
  "effective_level": 4,
  "level_source": "assessor",
  "override": {
    "level": 4, "notes": "Verified with take-home task.", "by": 12, "at": "2026-10-25T09:12:00Z",
    "lock_version": 1
  }
}
```
Not assessed: `rating_status: "not_assessed"`, `not_assessed_reason: "not_covered"`, `ai_level: null`, `confidence: null`, `effective_level: null` (or the assessor level if overridden, then `level_source: "assessor"`).

Portfolio adds `ratings_validated`, `generation_status`, `generation_error_code` and a safe `generation_error_message`; `generation_error` and the top-level `error` are removed.

### Override
- `POST /portfolio_skills/:id/override` body `{ "override": { "level": 3, "notes": "...", "lock_version": 0 } }` (old key `override_level` accepted for one release). 201 created, 200 updated; 422 missing/blank notes, level outside 1..5, or no change; 409 stale `lock_version`; 404 other tenant.
- `DELETE /portfolio_skills/:id/override` body `{ "notes": "..." }`: revert to AI level (or not assessed). 200; 422 without notes; 404 when no override or other tenant.
- `GET /portfolio_skills/:id/override_events`: `[{ "action": "set", "from_level": 2, "to_level": 3, "ai_level_at_time": 2, "notes": "...", "actor_id": 12, "at": "..." }]` newest first.

### Fit/gap report
`GET /portfolios/:id/fitgap/:vacancy_id`
```json
{
  "report": {
    "portfolio_id": 46, "vacancy_id": 16, "role_title": "Contoh Backend Engineer",
    "ratings_validated": true,
    "summary": {
      "total": 5, "evidenced": 3,
      "match": 2, "exceed": 1, "gap": 0,
      "not_assessed": 1, "low_confidence": 1, "overridden": 1
    },
    "comparisons": [
      {
        "skill_label": "SQL & Data Modeling", "skill_id": null,
        "expected_level": 3, "candidate_level": 3, "level_source": "assessor",
        "ai_level": 2, "is_override": true, "override_notes": "...",
        "confidence": null, "result": "match", "delta": 0, "counts_toward_fit": true
      },
      {
        "skill_label": "System Design", "expected_level": 4, "candidate_level": null,
        "level_source": null, "result": "not_assessed", "not_assessed_reason": "not_covered",
        "delta": null, "counts_toward_fit": false
      },
      {
        "skill_label": "API Design", "expected_level": 3, "candidate_level": 2, "level_source": "ai",
        "confidence": "low", "result": "low_confidence", "tentative_direction": "below", "delta": -1, "counts_toward_fit": false
      }
    ],
    "follow_up": ["System Design", "API Design"],
    "narrative": {
      "status": "complete", "source": "ai", "label": "AI generated, not a hiring decision",
      "culture": "...", "overall": "...", "generated_at": "...", "error_code": null
    }
  }
}
```
- `result` values: `match`, `exceed`, `gap`, `not_assessed`, `low_confidence`. Only `counts_toward_fit: true` rows enter match/exceed/gap totals (Q1).
- Status codes: 200 always when the portfolio is complete (narrative state inside); 409 `{"code":"portfolio_not_ready","generation_status":"generating"}` when the portfolio is not complete; 422 for a vacancy without skills; 404 cross-tenant.
- `POST /portfolios/:id/fitgap` (and `regenerate_fitgap`) request a narrative: 202 `{"narrative":{"status":"generating"}}` when a job is enqueued or already running; 200 when already complete and current.
- Export: `GET /portfolios/:id/export?format=pdf|json&vacancy_id=`; JSON gains `schema_version: 2` and the same view model; failures return JSON 422/500 with a safe message, never a stack trace.

---

## 6. UI/UX design

### Portfolio page (assessor)
```
[<] Portfolio Results  Kandidat Contoh A                [Transcript] [PDF] [JSON]
(!) Legacy banner (only if ratings_validated = false)
+----------------------------------------------------------------------------+
| Coverage: 4 of 5 configured skills evidenced  [#######---]  1 not assessed |
| 1 low confidence  |  1 assessor override                                   |
+----------------------------------------------------------------------------+
Tabs: [Configured skills (5)] [Discovered skills (1)]
+----------------------------------------------------------------------------+
| SQL & Data Modeling                          [L3 Assessor] (was AI L2)     |
| (shield) Confidence: Medium (i)   2 probes, partial                         |
| Note: "Verified with take-home task." by #12, 25 Oct 09:12  [History]      |
| > Evidence (2)  [accordion, quotes truncated to 3 lines + "Show more"]      |
| > Competency summary                                                       |
|                                           [Change rating] [Undo override]  |
+----------------------------------------------------------------------------+
| System Design                                [(?) Not assessed]             |
| Not covered in the interview. Probe in the next interview.  [Rate manually] |
+----------------------------------------------------------------------------+
Vacancy: [Select vacancy v] [Run fit/gap]
```
- Override is a **Dialog** (focus trapped, Esc closes): level radio L1 to L5 with anchor text, required note (character counter, max 2000), shows AI level and confidence for context. Undo uses **AlertDialog** with a required note. History opens a list (newest first).

### Fit/gap report page (recruiter, hiring manager)
```
[<] Fit/Gap Report  Contoh Backend Engineer           [Refresh narrative] [PDF]
+---------+---------+---------+------------------+-----------------+----------+
| Match 2 | Exceed 1| Gap 0   | Not assessed 1   | Low confidence 1| Overrides|
| (check) | (up)    | (alert) | (?)              | (shield-alert)  | 1 (user) |
+---------+---------+---------+------------------+-----------------+----------+
Evidenced: 3 of 5 skills [######----]  Only evidenced skills count toward fit.

Desktop: table               Mobile (<640px): stacked cards
Skill | Required | Candidate        | Result
SQL   | L3 o-o-*-o-o | L3 (Assessor, was AI L2) | (check) Match
SysD  | L4       | (?) Not assessed | Probe next interview
API   | L3       | L2 (Low conf.)   | (shield) Not counted: low confidence

Follow up in the next interview: System Design, API Design
System summary (computed): 3 of 5 skills evidenced; ...
[AI generated, not a hiring decision] Culture & competency narrative ...
   states: generating (skeleton + "usually under a minute"), failed + Retry,
           outdated ("Ratings changed since this text was written" + Refresh)
```
- `LevelScale`: five dots with required marker and candidate marker, plus the text "Required L3, Candidate L2" for screen readers.

### All states
| State | Portfolio | Fit/gap | Override dialog |
|---|---|---|---|
| Loading | Skeleton cards shaped like real cards | Skeleton summary + rows | Button spinner |
| Empty | "No skills in this portfolio" | Vacancy without skills: "Add required skills to this vacancy" with link | n/a |
| Generating | Progress text, polling stops on final state | Narrative skeleton only; table already visible | n/a |
| Failed | Callout with safe reason by error code + Retry | Narrative failed + Retry; table still usable | Inline error, input kept |
| Stale | n/a | Narrative "outdated" + Refresh | 409: "Someone changed this rating. Reload." |
| Partial | Not assessed cards inline | Not assessed rows + follow-up list | n/a |
| Legacy | Banner | Banner | n/a |
| Long text | Label wraps (break-words), evidence clamped to 3 lines + Show more | Label clamp 2 lines + Tooltip/expand | Note max length counter |
| Mobile 390 px | Single column, actions wrap | Cards instead of table, no horizontal scroll | Full-width dialog |
| Keyboard / contrast | All actions are buttons/links; tooltips focusable; status = icon + text, never colour or emoji alone; WCAG AA contrast | Same | Focus trap, labelled fields, error announced via `aria-live` |

### Component inventory
Reused from `web/src/components/ui/`: Card, Badge, Button, Tooltip, Accordion, Dialog, AlertDialog, Tabs, Progress, Skeleton, Textarea, Label, RadioGroup, Select.

New in `web/src/components/ui/` (design system, generic):
- `StatTile` (icon + label + value, used for summary counts)
- `CoverageBar` (Progress + "x of y" text)
- `Callout` (info / warning / error, icon + title + action slot; replaces ad hoc coloured divs)
- `ProvenanceLabel` ("AI generated" / "Assessor" / "System summary")
- `ClampText` (line clamp + Show more, accessible)

New domain components:
- `components/portfolio/RatingBadge` (replaces `LevelBadge` usage: level or "Not assessed", source assessor/AI)
- `components/portfolio/ConfidenceBadge` (icon + text + tooltip explaining the probe rule; replaces `ConfidenceIndicator`, which silently treats unknown values as LOW)
- `components/portfolio/OverrideDialog`, `OverrideHistory`
- `components/fitgap/FitGapSummary`, `SkillComparisonList` (table on desktop, cards on mobile), `LevelScale`, `NarrativeSection`

Emoji in the current table and override panel (check mark, star, warning, pencil) are replaced by lucide icons with text.

### PDF (Q4)
Rendered from the same presenter view model: header with candidate session and generation date; legacy banner when applicable; per skill "Not assessed (reason)" instead of a level; "Assessor L3 (AI L2)" with note, author and time; confidence with probe count; fit/gap table with Required, Candidate, Source, Result, counted yes/no; follow-up list; system summary; AI narrative under the label "AI generated, not a hiring decision" or "AI narrative unavailable". Bundled Noto Sans fonts; long text wraps.

---

## 7. Acceptance criteria

Format: Given / When / Then. "Test" = where the proof lives (model, service, request, worker, component, page). Findings in brackets.

### 7.1 Portfolio generation and rating validity
- **AC-01** [A1] Given a configured skill whose coverage state is `not_yet` or `initiated`, when the portfolio is generated, then the skill is stored with `rating_status = not_assessed`, reason `not_covered`, `ai_level` NULL, confidence NULL, even if the model returned a level. Test: service.
- **AC-02** [A1] Given the model returns `"level": null` for a covered skill, then it is stored as not assessed with reason `no_level_from_model`. Test: service.
- **AC-03** [A1, A2] Given the model returns `"level": "L3"`, `"tiga"`, `3.5` or `"3"`, then only an integer 1 to 5 (including the string "3" parsed strictly) is accepted; every other value is not assessed with reason `invalid_level_from_model`, never L1. Test: service (table-driven).
- **AC-04** [A1] Given the model returns `0`, `-1`, `6` or `7`, then the skill is not assessed (`invalid_level_from_model`), never clamped to 1 or 5. Test: service.
- **AC-05** [A2, A3] Given the model returns `confidence: "very_high"` or omits it, then the portfolio still completes and confidence is computed from coverage (D-7), not taken from the model. Test: service.
- **AC-06** [A2] Given `evidence` is a string, it is stored as a one-item array; given a number, object or null, evidence is `[]` and the skill is not assessed (`no_evidence`). Test: service.
- **AC-07** [A2] Given a covered skill with a valid level but zero evidence quotes, then it is not assessed (`no_evidence`). Test: service.
- **AC-08** [A2] Given the model output is invalid JSON, an empty string, or JSON without `configured_skills`, then the portfolio is `failed` with `generation_error_code = invalid_output` or `empty_output`, no skills are written, and the API returns a safe message. Test: service + request.
- **AC-09** [D3] Given one skill fails validation in the middle of the write (simulated DB error), then the transaction rolls back and the previous skills and overrides are unchanged. Test: service.
- **AC-10** [G2, D4] Given Gemini times out, returns 503, 403, or 429, then the portfolio is `failed` with codes `timeout`, `provider_unavailable`, `provider_denied`, `rate_limited`; the API exposes only the code and a human message; logs contain the exception class and status, not the prompt, transcript or response body. Test: service + request + log assertion.
- **AC-11** [D-7] Given coverage `covered` with probe_count 3, `partial` with 2, and `initiated` with 1, then confidence is high, medium, low respectively. Test: model/service.
- **AC-12** [A1] Given a skill label longer than 255 characters from the model, it is stored truncated to 255 with an ellipsis and the original length logged (no content); evidence of 5,000 characters is stored intact. Test: service.
- **AC-13** [D-2] Given two generator jobs for the same session start concurrently, then exactly one runs (status claim), the other exits without writing. Test: service/worker.
- **AC-14** [M2] Given a portfolio created before the migration, then `ratings_validated = false` and the API and UI show the legacy banner; its levels are unchanged. Test: migration spec + request + page.

### 7.2 Overrides and history
- **AC-20** [B4] Given no note or a whitespace-only note, when an assessor overrides, then 422 and nothing is written. Test: request + model.
- **AC-21** [B4] Given a valid override (level and note), then the current override is saved and one `set` event with from, to, ai level, note, actor and time is appended. Test: request.
- **AC-22** [D-2] Given the requested level equals the current effective level, then 422 "no change". Test: request.
- **AC-23** [B4] Given an existing override, when the assessor reverts with a note, then the effective level returns to the AI level (or not assessed), the current override is removed and a `revert` event is appended; reverting without a note returns 422. Test: request.
- **AC-24** [B1] Given a skill with an override, when the portfolio is regenerated, then the override, its events and the skill row persist; the AI level updates; the effective level stays the assessor level. Test: service.
- **AC-25** [B1] Given a regeneration where the model no longer returns an overridden skill, then the skill remains with `not_assessed` (`not_covered`) and its override intact. Test: service.
- **AC-26** [D-2] Given a not-assessed skill, when the assessor sets a level with a note, then `effective_level` is that level with `level_source = assessor`, and fit/gap counts it. Test: request + service.
- **AC-27** [D-2] Given two assessors edit the same override with the same `lock_version`, then the second gets 409 and no event is lost. Test: request.
- **AC-28** [B4] Given level outside 1 to 5 or a note longer than 2,000 characters, then 422. Test: request.
- **AC-30** [Could, Pasal 10] Given an assessed skill without an override, when the assessor uses "Confirm AI rating" (`POST /portfolio_skills/:id/confirm`), then a `confirm` event is appended, no level changes, and the skill shows "Confirmed by assessor"; on a not-assessed skill it returns 422. The note is optional for medium or high confidence and **required for low confidence** (422 `note_required`), because confirming thin evidence moves the skill from follow-up into the fit totals (decided by Rian, 24 Oct 2026). A confirmed level counts as human reviewed (`level_source: assessor_confirmed`). Test: request. First item to cut if time runs out.
- **AC-29** [M3] Given legacy overrides, after migration each has exactly one `set` event; overrides without notes get the explicit legacy marker. Test: migration spec.

### 7.3 Fit/gap
- **AC-40** [A4, Q1] Given a vacancy skill missing from the portfolio, then result `not_assessed`, `counts_toward_fit: false`, listed in `follow_up`, and summary `not_assessed` increments. Test: service (presenter).
- **AC-41** [A3, Q1] Given an AI level below the required level with confidence low, then result `low_confidence` with `tentative_direction: below`, not counted, listed in follow-up. Test: service.
- **AC-52** [A3, Q1] Given an AI level equal to the required level with confidence low, then result `low_confidence` with `tentative_direction: equal` ("tentatively matches"), not counted as a match, listed in follow-up. Test: service.
- **AC-53** [A3, Q1] Given an AI level above the required level with confidence low, then result `low_confidence` with `tentative_direction: above` ("tentatively above"), not counted as exceed, listed in follow-up. Test: service.
- **AC-54** [A3, Q1] Given a low-confidence skill with an assessor override, then the low-confidence status no longer applies: the result is computed from the assessor level and counts toward fit. Test: service.
- **AC-42** [baseline] Match, exceed and gap with deltas behave as today for evidenced, non-low-confidence skills (existing characterization specs stay green unchanged). Test: service.
- **AC-43** [B3, F1] Given an overridden skill, then the comparison has `expected_level`, `candidate_level` = assessor level, `ai_level`, `is_override: true`, `level_source: assessor`, and no AI confidence. Test: request.
- **AC-44** [A6, B6] Given an override or regeneration happens after a narrative was generated, then GET immediately returns updated comparisons and `narrative.status = outdated`; no report is deleted and no 404 is returned. Test: request.
- **AC-45** [D2] Given a complete portfolio and no narrative yet, GET returns 200 with `narrative.status = not_requested`. Test: request.
- **AC-46** [D1] Given POST is called twice (sequentially or concurrently) while a narrative is generating, then exactly one job is enqueued and both get 202. Test: request + worker (Sidekiq fake job count).
- **AC-47** [D2, A5] Given the narrative call fails (timeout, 503, 403, 429, empty), then `narrative.status = failed` with `error_code`, comparisons and summary still returned, and no fallback text pretending to be a narrative is stored. Test: worker.
- **AC-48** [Q1] Given a portfolio with no skills, then every vacancy skill is not assessed, summary `evidenced = 0`, and no match/gap totals are shown as a fit. Test: service.
- **AC-49** [edge] Given a vacancy without skills, then GET returns 422 with code `vacancy_has_no_skills`. Test: request.
- **AC-50** [D6] Given the worker runs for a report whose claim is no longer `generating` (duplicate), it exits without writing. Test: worker.
- **AC-51** [A5] Given a narrative from Gemini, then `narrative.source = ai` and the label text is present in API, UI and PDF. Test: request + component + PDF.

### 7.4 Tenant isolation
- **AC-60** [C1] Given a token for organisation B, when it calls any of: `GET /sessions/:id/portfolio`, `POST /sessions/:id/portfolio/regenerate`, `GET /portfolios/:id/fitgap/:vid`, `POST /portfolios/:id/fitgap`, `POST /portfolios/:id/regenerate_fitgap`, `GET /portfolios/:id/export` (pdf and json), `POST /portfolio_skills/:id/override`, `DELETE /portfolio_skills/:id/override`, `GET /portfolio_skills/:id/override_events` on organisation A's records, then each returns 404 and nothing is written or enqueued. Test: request (shared example per endpoint).
- **AC-61** [C1] Given organisation A's portfolio and organisation B's vacancy, then POST fitgap returns 404 and the worker refuses mismatched tenants if called directly. Test: request + worker.

### 7.5 PDF and export
- **AC-70** [B2, D-6] Given a portfolio with an override, PDF export returns 200 with `application/pdf`. Test: request (red today).
- **AC-71** [D-6] Given evidence and labels containing "→", emoji, accented letters ("é"), Javanese script, and a 5,000-character quote, PDF export returns 200 and the text wraps. Test: service. (Slice 5: skill labels are varchar(255), so the label is tested at 255 characters and the quote at 5,000. Characters no bundled font has, such as emoji, print as `[?]`.)
- **AC-72** [B5, Q4] Given not assessed, low confidence, override and AI narrative states, the PDF text contains "Not assessed", the confidence with probe count, "Assessor override" with the AI level, note, assessor and time (rendered as "L3 (Assessor override, AI L2)" in the fit/gap part), and "AI generated, not a hiring decision". Test: service, asserting the text of the rendered PDF with `pdf-reader` (test group), not only the view model.
- **AC-73** [B5] Given a legacy portfolio, the PDF shows the legacy notice. Test: service.
- **AC-74** [D5, C3] Given an export failure (portfolio not complete or rendering error), the response is JSON with a safe message; the UI shows an error message instead of an unhandled rejection. Test: request + component.
- **AC-75** [D-5] Given the same portfolio and vacancy, the JSON export and the fit/gap API return the same comparisons and summary (single presenter). Test: request.

### 7.6 Error exposure
- **AC-80** [C3] Given any portfolio or fit/gap failure, no response body contains `generation_error`, exception messages, or stack traces. Test: request.

### 7.7 UI (component and page tests)
- **AC-90** [A1] Not-assessed skills render "Not assessed" with an icon, the reason and a "Rate manually" action; never an L-level badge. Test: component.
- **AC-91** [A3] Confidence renders as icon + text + tooltip with the probe rule; unknown values render "Unknown", not LOW. Test: component.
- **AC-92** [B3, B4] An overridden skill shows "Assessor L3 (was AI L2)", the note, author and time, and History lists events. Test: component.
- **AC-93** [B4] The override dialog cannot be submitted without a note, shows server 422/409 errors inline and keeps input; Undo requires a note in an AlertDialog. Test: component.
- **AC-94** [A4, F1] The fit/gap summary shows six tiles (match, exceed, gap, not assessed, low confidence, overrides) and the coverage bar "x of y"; the Required column shows the expected level. Test: component.
- **AC-95** [D1] The fit/gap page only issues GET while polling, stops on `complete`, `failed` or `outdated`, and shows Retry on failure. Test: page (mocked service, fake timers).
- **AC-96** [D4] A failed portfolio shows a callout with a human message mapped from `generation_error_code` and Retry; the candidate list shows "Results failed" instead of "Completed". Test: page + component.
- **AC-97** [F2] At 390 px wide the fit/gap view renders cards, not a table, and the document has no horizontal overflow; labels of 200 characters and evidence of 1,200 characters are clamped with "Show more". Test: component (layout class assertions) + manual check with screenshots.
- **AC-98** [a11y] Every status is conveyed with icon and text (no emoji, no colour-only); dialogs trap focus and return it; tooltips open on keyboard focus. Test: component + manual keyboard pass.
- **AC-99** [F3] Discovered skills show "L2" format through the same `RatingBadge`. Test: component.

### 7.8 Needs review (slice 8, tier Could, added 26 Oct 2026)
Review reasons are computed per portfolio in one service on top of `Portfolios::SkillPresenter` and `FitGap::ReportPresenter`; configured skills only (discovered skills are excluded, the same as the portfolio summary).
- **AC-100** [Pasal 10, B] Given a complete portfolio with a configured skill whose AI confidence is low and that no assessor confirmed or overrode, and another configured skill without a level and without an override, when the review reasons are computed, then the portfolio has `unreviewed_low_confidence` (1) and `unreviewed_not_assessed` (1); after the assessor confirms the first and overrides the second, both reasons disappear. Test: service spec + request spec.
- **AC-101** [A5, D2] Given a portfolio with a fit/gap narrative that is `failed`, or `complete` with a digest that no longer matches the current ratings, when reasons are computed, then it has `narrative_failed` or `narrative_outdated` with the number of affected vacancies; given a legacy portfolio (`ratings_validated` false), a portfolio with `generation_status` failed, or a complete portfolio without any skill (scenario L), then it has `legacy_ratings`, `generation_failed` or `empty_portfolio` (the last two link to the portfolio and share the "Portfolios failed or empty" group). Test: service spec.
- **AC-102** [C1] Given portfolios that need review in organisation A and in organisation B, when an assessor of A calls `GET /api/v1/review_queue`, then only A's portfolios appear in `items` and `summary`. Test: request spec.
- **AC-103** [Pasal 10] Given several portfolios that need review, when the queue is requested, then items are ordered by how long they have waited (oldest first, never by any score), at most 50 per page with `meta` for the next page, and `reason` filters to one group (skills, narratives, legacy, generation_failed). Test: request spec.
- **AC-104** [N15] Given the candidate list of an assessment, when it is requested, then each session carries `portfolio_status` (`none`, `generating`, `ready`, `failed`) and `review_summary` (reasons with counts, empty when reviewed), and each assessment in the list carries `candidate_count` and `needs_review_count`; existing fields are unchanged. Test: request spec.
- **AC-105** [UI] Given the review queue, when the assessments page loads, then a "Needs review" section shows one StatCard per reason group (keyboard-operable with `aria-pressed`, filtering the list), the five oldest items with reason badges (icon + text), the waiting time and a Review link to the portfolio (skills, legacy, failed) or to the fit/gap report (narratives); an empty queue shows "Nothing needs review right now"; a failed load shows an error with Try again. Test: component + page.
- **AC-106** [N15, UI] Given a failed portfolio, a generating portfolio and a ready portfolio with unreviewed skills, when the candidate list renders, then the rows say "Portfolio failed", "Generating" and "Portfolio ready" with "N skills need review" (icon + text), and a reviewed ready portfolio says "Reviewed"; no row says "Completed" for a failed portfolio. Test: page.

Total: **66 acceptance criteria** (AC-01 to AC-14, AC-20 to AC-30, AC-40 to AC-54, AC-60 to AC-61, AC-70 to AC-75, AC-80, AC-90 to AC-106).

---

## 8. Test plan, red-first list, seeded fault

| Area | Spec files (planned) | Red on current code? |
|---|---|---|
| Rating validity | `spec/services/portfolios/rating_normalizer_spec.rb`, `spec/services/portfolios/generator_spec.rb` (extended) | Red: AC-01 to AC-09, AC-12, AC-13 |
| Gemini failures | `spec/services/portfolios/generator_failure_spec.rb`, `spec/workers/fit_gap_generator_worker_spec.rb` | Red: AC-10, AC-47 |
| Overrides | `spec/requests/api/v1/portfolio_skills_spec.rb`, `spec/models/assessor_override_event_spec.rb` | Red: AC-20 to AC-28 |
| Migrations | `spec/migrations/*_spec.rb` (run migration on fixture rows) | Not applicable (new) |
| Fit/gap | `spec/services/fit_gap/report_presenter_spec.rb`, `spec/requests/api/v1/fit_gap_spec.rb` | Red: AC-40, 41, 43 to 49; AC-42 green (baseline, existing engine spec unchanged) |
| Tenant | `spec/requests/api/v1/tenant_isolation_spec.rb` with a shared example per endpoint | Red: AC-60, AC-61 (every endpoint except the session-scoped GET) |
| PDF | `spec/services/exports/pdf_generator_spec.rb` (rendered PDF text extracted with `pdf-reader`, added to the `:test` group per decision 11.6) | Red: AC-70, AC-71, AC-72 |
| Errors | request specs asserting response keys | Red: AC-80 |
| Web | `ConfidenceBadge.test.tsx`, `RatingBadge.test.tsx`, `OverrideDialog.test.tsx`, `FitGapSummary.test.tsx`, `SkillComparisonList.test.tsx`, `FitGapReportPage.test.tsx`, `PortfolioPage.test.tsx` | Red where the component exists today (ComparisonTable required column, ConfidenceIndicator unknown as LOW); new components are test-first |

Commit rhythm per slice: `test(...)` commit with the failing specs (message states it is intentionally red), then `fix(...)`/`feat(...)` turning them green, recorded in `log-bukti.md` with the command and the failure summary.

**Seeded fault test (to run only when Rian asks, on a scratch branch):** reintroduce `skill_data['level'].to_i.clamp(1, 5)` inside the new rating normaliser. Expected to fail: AC-02, AC-03, AC-04 (service), AC-40/AC-48 indirectly through presenter specs that build portfolios via the generator, and AC-72 (PDF must say "Not assessed"). The fault is then reverted with a visible commit.

---

## 9. Delivery plan

**Decided (Rian, 24 Oct 2026): Option A from the brief.** Cross-repository PRs from a fork cannot be stacked, so all slices are built in order on the single branch `feat/honest-fit-gap-report`, with commits grouped per slice (red `test:` commit, then `fix:`/`feat:`). At the end there is one comprehensive PR to `rakamindev/ai-interview-platform` whose description is organised per slice. No sub-PRs on the fork. Opening the PR is Rian's decision. The "branch" column below is now only a slice label.

| # | Slice (branch) | Findings / AC | Migrations | Size `[estimate]` | Commits (red then green) |
|---|---|---|---|---|---|
| 1 | Tenant isolation (`fix/tenant-scope-portfolio`) | C1 / AC-60, 61 | none | about 150 lines, mostly specs | `test(api): add cross-tenant request specs for portfolio endpoints` (red), `fix(api): scope portfolio, skill and fit/gap lookups by tenant` |
| 2 | Not assessed + validated generator (`feat/not-assessed-ratings`) | A1, A2, D3, A3 data, C3 part / AC-01 to 14, 80 | M1, M2 | about 500 lines | `test(api): specify rating validation for model output` (red), `feat(api): allow not-assessed portfolio skills` (migration), `fix(api): validate model output and write portfolio in a transaction`, `feat(api): compute confidence from coverage` |
| 3 | Durable overrides (`feat/override-history`) | B1, B4 / AC-20 to 29 | M3 | about 400 lines | `test(api): specify override persistence and history` (red), `feat(api): add override events and stable skill identity`, `fix(api): keep overrides when a portfolio is regenerated` |
| 4 | Fit/gap lifecycle + contract (`feat/fitgap-on-read`) | A4, A5, A6, B3, B6, D1, D2, D6, F1 / AC-40 to 51, 75 | M4 | about 500 lines | `test(api): specify fit/gap presenter and narrative lifecycle` (red), `feat(api): compute fit/gap on read with narrative status`, `fix(api): make narrative generation idempotent` |
| 5 | PDF from presenter (`fix/pdf-parity`) | B2, B5, D5 / AC-70 to 74 | none (font files added) | about 250 lines + fonts | `test(api): reproduce PDF failure with overrides and unicode` (red), `fix(api): render PDF from shared view model with bundled font` |
| 6 | UI (`feat/fitgap-ui`) | A3 UI, A4, B3, B4, D1, D4, D5, F1 to F3 / AC-90 to 99 | none | about 900 lines incl. tests | `test(web): ...` (red where components exist), `feat(web): add design system tiles, callout, clamp text`, `feat(web): portfolio ratings and override dialog`, `feat(web): fit/gap summary, list and narrative states` |

Every slice: RSpec + Vitest + build green before the green commit; `db:migrate`, `db:rollback`, `db:migrate` recorded for slices 2 to 4; dev scenario seed updated so screenshots can be retaken.

---

## 10. Risks, cut lines, rollback

| Risk | Mitigation |
|---|---|
| Unique `skill_key` index fails on existing duplicate labels | Pre-check in migration aborts with the list; no silent dedupe |
| Prompt change alters rating behaviour | Code-level rule (coverage + evidence) is authoritative; prompt change is secondary; seed scenarios re-run |
| Front end and API contract drift during parallel work | Shared JSON fixture used by RSpec and Vitest |
| Gemini capacity (503, timeouts) during demo | Fake client in tests and seeds; failure states are now first-class UI |
| Scope too large for the deadline | Cut in this order: Could tier (F2 beyond basics, F3, D4, D5, D6 explicit test), then A5 UI polish, then `override_events` read endpoint (history still recorded). Never cut: slices 1 to 4 and the PDF crash fix |

Rollback per migration: M1 down refuses when NULL levels exist (prevents recreating the bug), otherwise restores constraints; M2 down drops the flag and code column; M3 down drops events (current overrides untouched); M4 down drops lifecycle columns. Code rollback is by reverting the slice PR; slices are ordered so each can be reverted from the top.

---

## 11. Decisions (answered by Rian, 24 Oct 2026)

All recommendations approved, with these changes: (2) same-level override stays 422, plus a separate "Confirm AI rating" action as a Could item in slice 3 (AC-30); (4) low confidence is never counted in any direction, shown with a tentative direction (AC-41, AC-52 to AC-54); (6) add `pdf-reader` to the `:test` group and assert real PDF text; (10) single branch, one comprehensive PR (section 9). Original questions kept below for the record.

### Original questions

1. **Approve D-1 to D-8 recommendations** (A, A, B, A, A, A, A, A). Recommended: approve as listed.
2. **Override to the same level** (no change): reject with 422 (recommended), or accept as "assessor confirmed AI rating" event, which would also document human review under Pasal 10.
3. **"No evidence, no level" rule** (AC-07): a covered skill without any quote is not assessed. Recommended: yes.
4. **Low confidence in fit/gap**: shown as its own result `low_confidence`, not counted, listed for follow-up (Q1). Recommended: yes, even when an override is absent; an assessor override clears it.
5. **Legacy portfolios**: flag with a banner and leave levels unchanged (recommended), rather than bulk-marking legacy L1 as not assessed.
6. **PDF tests**: assert through the presenter view model plus a smoke render (recommended, no new gem), or add `pdf-reader` as a test-only gem for text assertions.
7. **Bundled fonts**: add Noto Sans regular and bold (SIL OFL, about 1 MB) under `api/vendor/fonts` with the licence file. Recommended: yes.
8. **Remove the template fallback narrative** in favour of the computed system summary (D-8). Recommended: yes.
9. **Tenant fix scope**: explicit scoping now, denormalised `tenant_id` as a documented follow-up (D-4). Recommended: yes.
10. **Delivery**: umbrella PR + six sub-PRs in the order above. Recommended: yes.
