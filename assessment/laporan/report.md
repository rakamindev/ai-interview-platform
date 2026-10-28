# Honest Fit/Gap Report: Case Study Report

| | |
|---|---|
| Candidate | Ahmad Rian |
| Position | Frontend Engineer Intern |
| Pull request | [github.com/rakamindev/ai-interview-platform/pull/204](https://github.com/rakamindev/ai-interview-platform/pull/204) |
| Video | [Walkthrough (3:56), Indonesian narration with English captions](https://drive.google.com/file/d/1XYU7EQfpCOGGVCAS2AzUlb637JqtGW2z/view?usp=sharing) |
| Branch | `ahmad-rian/ai-interview-platform`, `feat/honest-fit-gap-report` (head `a3f51fb`) |
| Date | 28 October 2026 |

## TL;DR

1. **The product made uncertainty look certain.** A skill nobody asked about was stored as "L1, Confidence: High" and printed as "Gap -2" in the PDF a hiring manager receives; that PDF crashed for any portfolio a human had corrected.
2. **The human check was not durable.** Overrides vanished on regeneration, needed no reason, could not be undone and never showed in fit/gap. Another organisation could read and overwrite a candidate's ratings.
3. **The revamp makes the flow say only what the evidence supports**: "not assessed" is a real state, low confidence never counts toward fit, every human decision has a note and a history, fit/gap is computed on read, and the PDF is rendered from the same presenters as the screen.
4. **It was built test first** on a repository that had no tests and no CI: 228 RSpec examples and 251 Vitest tests, every fix red by test name before green, and three seeded faults caught by CI and reverted in visible history.
5. **What remains is out of the revamp's scope, not hidden**: candidate consent and Indonesian UI, the bandwidth gate, production boot configuration and Gemini capacity are written up as follow-ups with owners.
6. **Frontend focus.** Most of the visible work is frontend: a design system and visual foundation for every assessor page (colour tokens tuned for contrast, `PageShell` and `PageHeader`, `ListRow`, `StatusBadge`), the Fit/Gap and Portfolio screens, the override, confirm, undo and history dialogs, and the Needs review section. Accessibility is part of the design: everything works from the keyboard, every review action has a unique name per skill, text meets WCAG AA contrast, touch targets are 44 px, and pages fit 360 px without horizontal scrolling. The visual audit found the LevelRadio data bug (the level label of skill 3 changed skill 1), fixed with a red test first, and the web suite has 251 tests. The backend side (tenant isolation, the PDF and the shared presenters) was built as well.

## Step 2: Context and domain

### Insights

| Insight | Why it matters for the revamp |
|---|---|
| The decision artefact is the PDF, not the screen (PRD-02 ends with an export for the hiring manager) | The PDF must carry the same states as the screen: not assessed, low confidence, overrides, AI label |
| Indonesian youth unemployment is 17.37% (May 2026) and about 2.55 million graduates enter the market each year | When screening filters volume, one fabricated gap silently removes a person |
| Structured interviews are the strongest selection method, but LLM judges are inconsistent and overconfident | Value comes from evidence, anchors and calibrated human review, not automation |
| UU PDP 27/2022 Pasal 10 gives candidates the right to object to decisions based solely on automated processing; PP 33/2026 (in force 16 January 2027) requires a human alternative | Human review has to be real, recorded and visible, not a free-text field |
| Tenant isolation was broken (finding C1) | In production this is a breach with a 3 x 24 hour notification duty (Pasal 46) |

### Who is affected

| User | Need | Harm before the revamp |
|---|---|---|
| Candidate | Be judged only on what was asked and answered | Unmeasured skills counted as gaps; data visible to other organisations; no notice or consent |
| Assessor | Correct the AI with a reason that sticks | Corrections lost on regeneration; no history; PDF crash |
| Recruiter, hiring manager | One honest document per candidate and vacancy | Empty Required column, hidden overrides, template text that read like analysis, endless spinner |

UU PDP mapping (consent, purpose, Pasal 10, DPIA under Pasal 34, cross-border transfer under Pasal 56) is in `02-context-and-domain.md`, sections 6 and 7.

## Step 3: Problems and gap to the ideal

### Core problem

The product turns uncertain interview evidence into output that looks certain, and the human check that should catch it is neither durable nor visible. On top of that, candidate records were not isolated between organisations.

### Findings (37: P0 4, P1 19, P2 11, P3 3)

| ID | Sev | Finding | Impact (one sentence) | Status |
|---|---|---|---|---|
| A1 | P0 | Missing or invalid AI level coerced to L1 to L5 | A skill never rated becomes "Gap -2", so the candidate is marked down for something never measured | Fixed (slice 2) |
| B1 | P0 | Regeneration deletes assessor overrides | An assessor's correction disappears and the candidate silently reverts to the AI rating | Fixed (slice 3) |
| C1 | P0 | Cross-organisation read and write | Another company can export and overwrite a candidate's ratings | Fixed (slice 1) |
| C2 | P0 | No candidate notice or consent | Candidates are recorded and scored by AI without the information UU PDP requires | Out of scope (Q5), memo |
| A2 | P1 | Model output not schema-validated | One malformed field fails the portfolio or silently changes values | Fixed (slice 2) |
| A3 | P1 | Confidence ignored in fit/gap; AI confidence shown next to human level | A gap backed by one weak quote looks identical to a proven gap | Fixed (slices 2, 4, 6a) |
| A4 | P1 | "Not assessed" missing from totals | Two unmeasured skills read as "Match: 3, 0 gaps" | Fixed (slices 4, 6a) |
| A5 | P1 | Narrative provenance not shown | Template text on timeout reads like an AI assessment | Fixed (slice 4, D-8) |
| A6 | P1 | Stale fit/gap after portfolio changes | Old levels returned as current | Fixed by design (D-3) |
| A8 | P1 | Level label in skill 3 changed skill 1 | The wrong required level reached fit/gap | Fixed (slice 7) |
| A9 | P1 | Failed load showed an empty, saveable edit form | Saving erased the vacancy's culture and competency text | Fixed (slice 7) |
| B2 | P1 | PDF export crashed for overridden portfolios | The official document could not be produced after a human correction | Fixed (slice 5) |
| B3 | P1 | Override invisible in fit/gap | Human review could not be shown or audited | Fixed (slices 4, 6a) |
| B4 | P1 | Override needed no note, no undo, history overwritten | No record of why a level changed | Fixed (slice 3) |
| B5 | P1 | PDF without decision states | The official document overstated certainty | Fixed (slice 5) |
| D1, D2 | P1 | Polling re-enqueued jobs; report had no status | 11 duplicate jobs observed and an endless spinner | Fixed (slices 4, 6a) |
| D3 | P1 | Portfolio written without a transaction | A mid-write failure left a partial portfolio | Fixed (slice 2) |
| F1 | P1 | Required column empty (seam: `expected_level` vs `required_level`) | Levels shown with nothing to compare against | Fixed (slices 4, 6a) |
| E1, E2, G1, G2 | P1 | Bandwidth gate, invite host, production boot, Gemini capacity | Candidates blocked or links wrong; ops risk | Memo items, out of scope |
| B6, D4, D5, D6, F2 | P2 | Reports deleted by overrides, failure without reason, export errors, race, mobile overflow | Lost data, invisible failure, broken mobile | Fixed (slices 2 to 8) |
| C3 | P2 | Raw internal errors sent to client and logs | Leaky API and logs | Fixed in the touched paths (codes and error classes only); session start/end handlers still log `e.message` |
| A7, C4, E3, E4, G3 | P2 | Taxonomy id dropped, third-party calls, English-only, candidate 401 redirect, FK on delete | Various | Out of scope, listed |
| F3, F4, G4 | P3 | "2" vs "L2", empty "(expected )", docs drift | Inconsistency | F3 and "(expected )" fixed; tenant label and docs remain |

### Missing specification vs broken implementation

Eight findings are pure gaps in the wiki specification (human review trail, narrative provenance, report lifecycle, candidate notice) and two more are both a gap and a defect (A1, A3); they needed product decisions, which were taken as Q1 to Q5. The rest are implementation defects against the wiki (for example PRD-01 section 5 defines confidence as a rule, the code asked the model).

### API and web seam

The same data was computed in one layer and interpreted differently in another: `expected_level` vs `required_level`, `is_override` never emitted, confidence absent from the web type, `not_assessed` missing from totals, 404 meaning both "not generated" and "generating". Root cause: no shared, typed contract and two renderers (React and Prawn). Decision D-5 introduced one presenter per concept for JSON, web and PDF.

### Constraint signal to the Tech Lead

Escalated before building: tenant isolation (blocker), production boot configuration, the LLM output contract, the "not assessed" semantics change to fit/gap totals, report lifecycle schema changes, Gemini capacity and configuration, the human-in-the-loop policy, candidate-side compliance and data retention. Full memo: `03-problems-and-gaps.md`, section 7.

## Step 4: Options, trade-offs and acceptance criteria

| ID | Chosen | Rejected and why |
|---|---|---|
| D-1 Not assessed | Nullable level + `rating_status` + reason; "no evidence, no level" | Level 0 sentinel enters arithmetic and recreates the bug |
| D-2 Overrides | Stable skill key, upsert, append-only events, note required, undo, 409 on conflict | Portfolio versioning is too invasive for the deadline |
| D-3 Fit/gap | Computed on read; only the narrative is async with status, digest and an atomic claim | A cached report needs every write path to remember invalidation |
| D-4 Tenancy | Explicit scope through the session's tenant; 404 for other organisations | Denormalised `tenant_id` is the durable follow-up; Pundit needs a new dependency |
| D-5 Contract | One presenter per concept shared by JSON, web and PDF | Renaming fields one by one lets drift return |
| D-6 PDF | Bundled Noto fonts, render from presenters, transliterate unsupported glyphs | HTML to PDF adds a system dependency |
| D-7 Confidence | Computed from the coverage map as the wiki defines | Model self-confidence is overconfident |
| D-8 Narrative | No template fallback; system summary plus a labelled optional AI narrative | A labelled fallback still impersonates analysis |

**Priorities.** Must: C1, A1, A2, B1, B4, D3, A3 (data), A4, F1, B3, D1, D2, A6, B6, B2. Should: A3 (UI), A5, B5, C3. Could: F2, F3, D4, D5, D6, and slice 8 (Needs review).

**Acceptance criteria** (66 in total, `04-strategy-and-acceptance-criteria.md`), for example:

| AC | Given / When / Then (shortened) |
|---|---|
| AC-02 | Given model output without a level, when the portfolio is generated, then the skill is not assessed with reason `no_level_from_model`, never L1 |
| AC-41 | Given an unreviewed low-confidence skill, when fit/gap is computed, then it is `low_confidence`, does not count in either direction and appears under follow-up |
| AC-60 | Given a portfolio of organisation A, when organisation B calls any portfolio, fit/gap, export or override endpoint, then the response is 404 with no writes and no jobs |
| AC-95 | Given a narrative in progress, when the page polls, then it only sends GET and stops on complete, failed or outdated |
| AC-104 | Given the candidate list, when it is requested, then each row has `portfolio_status` and `review_summary`, so a failed portfolio never looks completed |

## Step 5: What was built

### Slices

| Slice | Commits | Result |
|---|---|---|
| 0 Harness | `a1a0de5..98aa8d8` | RSpec, Vitest, CI, Zeitwerk fix, dummy seed |
| 1 Tenant isolation | `1670e37..4a2245a` | Every touched endpoint scoped; 404 for other organisations |
| 2 Not assessed | `84a82b8..21fb11f` | M1, M2; validated output; transactional, claimed generation |
| 3 Overrides | `4905602..9d34050` | M3; durable overrides, required notes, history, undo, confirm |
| 4 Fit/gap on read | `73a2045..6d49aad` | M4; narrative lifecycle; polling only reads |
| 5 PDF | `c5d7f9e..e14354a` | PDF from shared presenters, bundled fonts, text-level tests |
| 6a Fit/Gap UI | `6d64bad..5219efd` | Evidence, coverage and review state; design system; AA colours |
| 6b Portfolio UI | `1b9c73f..951a237` | Review dialogs, 409 handling, results menu |
| 7 Visual foundation | `aa3a55c..38d2f1f` | Two data bugs found in the audit (A8, A9); page shell; 44 px targets; contrast |
| 8 Needs review | `05832a5..a428ad6` | Seven review reasons, review queue API, honest candidate statuses |
| Final a11y | `ffda702..c19c111` | Review actions and level group named per skill |
| Login page | `b9954bf..a3f51fb` | Product name, helper text, password toggle |

### Test evidence

| Measure | Before | After |
|---|---|---|
| RSpec examples | 0 (no `spec/` directory) | 228, 0 failures (also with `CI=true`) |
| Vitest tests | 0 (no runner) | 251 in 43 files |
| CI | none | GitHub Actions for API and web on every push and PR; latest run 40369090527 green |
| Type check, build | not run | `tsc --noEmit` clean, `vite build` succeeds |

- Pattern: a `test:` commit that is red by test name on the old code, then the `fix:` or `feat:` commit that makes it green. Each commit was built and checked in a temporary worktree; when a new test file failed only at import, it was also run against stubs so every assertion was seen failing.
- Old assertions were changed only twice, each in its own commit with the old value, the new value and the reason (the "Completed" status that locked in N15, and the review action names for W1).

### Seeded fault test

Three faults were planted in a scratch branch, one commit each, then reverted with `git revert`. The branch is named `fix/seeded-fault-demo` because the CI workflow only runs for `feat/**`, `fix/**` and pull requests; the workflow was not changed.

| Fault | Decision it attacks | CI run (fault) | Caught by | CI run (revert) |
|---|---|---|---|---|
| Missing or invalid levels clamped to 1..5 again | A1, D-1 | 40310894123 failure | 11 `rating_normalizer_spec` examples (AC-02 to AC-04) | 40311115824 success |
| Tenant filter removed from portfolio lookups | C1, D-4 | 40311288476 failure | 4 `tenant_isolation_spec` examples (export, intruder vacancy) | 40311417393 success |
| Unreviewed low confidence counted toward fit | Q1, D-3 | 40311585888 failure | 4 `report_presenter_spec` + 1 `pdf_generator_spec` examples | 40311767855 success |

### AI verification moments (selected)

| # | What the AI produced | How it was caught | Evidence |
|---|---|---|---|
| 1 | Tenant specs that used the victim's vacancy, so the real attack was not tested | First red run contradicted the Step 1 reproduction | `1670e37`, `4a2245a` |
| 2 | A claim window based on retries that never happen for POST | Read the `faraday-retry` source before writing the constant | `ec906bb`, finding N16 |
| 3 | A "green" PDF run that still executed the old generator | Stack trace named a method that only existed in the old file | `c5d7f9e`, `e14354a` |
| 4 | `aria-level=4` that passed in jsdom but not in Chrome | Chrome accessibility snapshot showed no level 4 | `a584b22`, `d7be01e` |
| 5 | A reproduction test that passed on the broken code | "4 failed, 1 passed" in a commit meant to be fully red | `b1522ce`, `68d79e0` |

Details: `ai-verification-selected.md`; all 70 moments: `log-bukti.md`.

### Migrations

| Migration | Change | Rollback |
|---|---|---|
| M1 | Not assessed skills, skill key, coverage snapshot | Refused if not-assessed skills exist (would invent a level) |
| M2 | Legacy flag, safe error code, claim timestamp | Reversible |
| M3 | Override events, lock version, required note | Refused if overrides on not-assessed skills exist |
| M4 | Narrative lifecycle on fit/gap reports | Reversible |

Verified on the test database: rollback of all four to the original schema and migrate again; migrate and seed on an empty database.

## Screenshots

### Before

![01](img/01-before-fitgap-C-tidak-dinilai-jadi-L1-1280.png)
*1. Before: a skill the AI never rated shows as L1 and counts as a gap.*

![02](img/02-before-fitgap-E-override-required-kosong-1280.png)
*2. Before: the Required column is empty and the human override is invisible.*

![03](img/03-before-fitgap-spinner-tanpa-akhir-1280.png)
*3. Before: a failed report spins forever while a new job is queued every 5 seconds.*

![04](img/04-before-8-invite-1280.png)
*4. Before: every finished interview says "Completed", including failed portfolios (N15).*

### After: the flow

![05](img/05-after-6a-C-not-assessed-bukan-L1-1280.png)
*5. Not assessed skills are shown as such, never counted, and listed for follow-up.*

![06](img/06-after-6a-D-low-confidence-1280.png)
*6. Low confidence shows its probe count and a tentative direction, and does not count toward fit.*

![07](img/07-after-6b-dialog-override-1280.png)
*7. Overriding a rating requires a level different from the current one and a reason.*

![08](img/08-after-6b-dialog-confirm-low-confidence-1280.png)
*8. Confirming a low-confidence rating requires a note, because it moves the skill into the totals.*

![09](img/09-after-6b-dialog-riwayat-1280.png)
*9. Review history lists every set, confirm and undo with author, time (UTC) and note.*

![15](img/15-after-8-assessments-1280.png)
*10. The assessments page shows what still needs a human, oldest first, with a link to the right page.*

![16](img/16-after-8-invite-1280.png)
*11. The candidate list says what each portfolio is and what still needs review.*

![20](img/20-pdf-export-E-override-confirm.png)
*12. The exported PDF shows the same states as the screen, including overrides and confirmations.*

### Edge cases and error states

![10](img/10-after-6b-409-konflik-1280.png)
*13. A conflicting edit returns 409; the dialog keeps the input and offers to load the latest rating.*

![11](img/11-after-6a-K-narasi-outdated-1280.png)
*14. A narrative written before a rating changed is marked outdated, not shown as current.*

![12](img/12-after-6a-B-partial-narasi-gagal-1280.png)
*15. When the AI narrative fails, the comparison still stands and the reason and Retry are shown.*

![13](img/13-after-6b-H-generate-gagal-1280.png)
*16. A failed portfolio explains why in plain language and offers Retry.*

![14](img/14-after-6a-404-lintas-tenant-1280.png)
*17. Another organisation's portfolio behaves as if it does not exist.*

### Responsive and accessibility

![17](img/17-after-8-invite-360.png)
*18. At 360 px the candidate list stacks, with 44 px touch targets and no horizontal scroll.*

![18](img/18-after-7-fitgap-390.png)
*19. At 390 px the fit/gap report uses cards instead of a table.*

![19](img/19-after-7-fitgap-zoom200-1280.png)
*20. At 200% text size the summary labels wrap by words instead of being cut off.*

## Assumptions

| Assumption | Where it matters |
|---|---|
| Hiring managers decide from the PDF and a short conversation, not from the web app | PDF parity was treated as Must |
| Data volumes are small enough for in-place backfills and for computing review reasons in Ruby | M1 to M4; review queue (9 queries for 50 portfolios) |
| No external consumers of the fit/gap JSON exist | The contract was changed (`schema_version: 2` in the export) |
| Gemini acts as a sub-processor and data leaves Indonesia | Memo items on consent and cross-border transfer |
| Voice is personal data but not biometric unless used for identification | UU PDP mapping |
| Personas (assessor, HR lead, candidate) come from the wiki and industry context, not user interviews | Step 2 |
| A legacy L1 cannot be told apart from a real L1 | Legacy portfolios are flagged, not rewritten |
| Configured skills are the requirement; discovered skills are extra findings | Review reasons and summaries count configured skills only |
| "Waiting since" is when the portfolio was generated (or the interview ended for a failed one), because portfolios have no timestamps | Review queue order |

## Limitations and follow-ups

| Item | Status |
|---|---|
| Live voice interview was not run end to end (microphone, Gemini Live) | Judged from PRD-02, code and seed |
| Gemini narratives time out or are unavailable on the current quota | The UI shows the reason and Retry; capacity is an ops decision (G2) |
| Candidate notice, consent, Indonesian UI, realistic bandwidth gate | Out of scope by decision Q5; memo item 8 |
| Denormalised `tenant_id` on portfolio tables | Follow-up to D-4 |
| Production boot configuration (`config.active_job`) | Needs a deploy-file decision (G1) |
| Deleting a session with a fit/gap report (foreign key) | Open (N7) |
| Touch target tests check classes; sizes were measured in Chrome | jsdom has no layout |
| Screen reader use verified through Chrome's accessibility tree, not with VoiceOver or NVDA end to end | Recommended before release |
| 200% text zoom tested with Chrome root font size, not Firefox "zoom text only" | Recommended check |
