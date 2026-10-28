# 03. Problem Definition and Gap to Ideal Condition

Step 3 of the case study. Analysis only; no code changed. Evidence references point to `assessment/01-setup-dan-eksplorasi.md` (findings #1 to #16, N1 to N15), `assessment/log-bukti.md`, and `assessment/02-context-and-domain.md`. PRD references are to the product wiki (PRD-01: AI interview behaviour and prompts; PRD-02: end-to-end simulation). Product decisions Q1 to Q5 from Rian (24 Oct 2026) are applied as requirements.

---

## 1. Core problem

The product turns uncertain interview evidence into output that looks certain: a skill nobody asked about becomes "L1, Confidence: High", a thin-evidence gap looks identical to a proven one, and a failed AI call produces text that reads like an assessment. The human check that should catch this is not durable or visible: an assessor's correction can vanish on regeneration, never shows in the fit/gap view, and makes the official PDF crash. On top of that, the records are not isolated between organisations, so a candidate's rating can be read and changed by a company that never interviewed them.

---

## 2. Severity definitions

Used consistently below.

| Level | Definition |
|---|---|
| **P0** | Harms a candidate wrongly without anyone noticing, leaks or alters data across organisations, or breaches a legal obligation already in force |
| **P1** | A hiring decision is made from misleading data, or a core flow is broken, but a careful user could notice |
| **P2** | Lowers trust, efficiency or UX quality; a workaround exists |
| **P3** | Cosmetic, documentation, or code hygiene |

Kind: **Missing spec** = never defined in the wiki or by product decision; **Broken** = defined (wiki, product decision Q1 to Q5, or the code's own contract) but not working; **Both** = the wiki is silent or ambiguous and the implementation also fails its own intent.

---

## 3. Ideal vs current, per user

| User | Ideal: can trust or do | Current | Gap |
|---|---|---|---|
| Assessor | Every level is backed by evidence or marked "not assessed"; corrections persist with a reason and history; failures are visible with a reason | Missing levels become L1; overrides vanish on regeneration, need no reason, cannot be undone; failed portfolios show "Completed" in the list and "generation failed" with no reason | Cannot rely on the portfolio or on their own corrections |
| Recruiter | Fit/gap counts only measured gaps; "not assessed" and low-confidence listed for follow-up (Q1); report states generating / failed / stale | Required column empty; low-confidence and fabricated gaps counted; summary ignores "not assessed"; endless spinner and duplicate jobs on failure | Advances or rejects from a misleading table |
| Hiring manager | One PDF that matches the screen: required vs candidate, not assessed, confidence, override (AI vs assessor), narrative labelled "AI generated" (Q4) | PDF prints fabricated L1 and gaps; no AI label; no override shown; crashes for any corrected portfolio | Decides from a document that overstates certainty, or gets no document |
| Candidate | Knows they are recorded and scored by AI; can start on an ordinary mobile connection; unmeasured skills are not counted against them; data seen only by the inviting company; a human reviews before any decision (UU PDP Pasal 10) | No notice or consent; 4 Mbps upload gate; English-only UI; unprobed skills stored as L1; another organisation can read and overwrite their ratings | Harmed silently, with no visibility or recourse |

---

## 4. Findings by theme

Columns: ID (original reference), Sev, Kind, Layer, Harmed, Impact (one sentence), Evidence / location, PRD.

### A. Assessment correctness

| ID | Title | Sev | Kind | Layer | Harmed | Impact | Evidence / location | PRD |
|---|---|---|---|---|---|---|---|---|
| A1 (#1, #2) | Missing or invalid AI level coerced to a level | **P0** | Both | api, data | Candidate, HM | A skill the AI never rated is stored as L1 ("Confidence: High") and becomes a "Gap -2" in the PDF, so the candidate is marked down for something never measured. | Scenario C: `nil`, `"L3"`, `0`, `"tiga"` stored as 1, `7` as 5; `generator.rb` `save_skills` `to_i.clamp(1, 5)`; `schema.rb` `ai_level NOT NULL` + CHECK 1..5 | PRD-01 §5 (level from consistent evidence; no "not assessed" state defined) |
| A2 (#13) | Model output not schema-validated | P1 | Broken | api | Candidate, assessor | One malformed field (e.g. `confidence: "very_high"`) fails the whole portfolio or silently changes values, so the candidate gets no result or a wrong one. | Scenarios H, I; `generator.rb` `save_skills`; `http_client.rb` `parse_response` | PRD-01 §5 output schema |
| A3 (#6, #14, N1) | Confidence not used or shown in fit/gap; AI confidence attached to human level | P1 | Both | api, seam, web | Candidate, recruiter, HM | A gap backed by one weak quote looks identical to a proven gap and is counted, contrary to Q1. | Scenario D; `engine.rb` `build_skill_comparisons` (delta only); `ComparisonTable.tsx` ignores `confidence`; confidence asked from model, not computed | PRD-01 §5 rule 4 (deterministic confidence, not implemented); PRD-02 Phase 5 U10 (no confidence column) |
| A4 (#5) | "Not assessed" missing from summary and fallback narrative | P1 | Broken | api, web | Candidate, HM | With 2 of 5 skills unmeasured, the screen says "Match: 3 skills" and the narrative "0 gaps", which reads like a perfect fit. | Scenario B; `ComparisonTable.tsx` summary; `engine.rb` `generate_fallback_narrative` | PRD-02 Phase 5 (narrative frames gaps as items to probe) |
| A5 (log Step 1, #5) | Narrative provenance not shown | P1 | Missing spec | api, web, PDF | HM, candidate | When Gemini times out or returns 503 a template sentence is stored with no label, and real AI narrative is also unlabelled, so a manager reads machine text as an assessment. | Step 1 log: 30 s timeout and 503 lead to `FALLBACK`; `engine.rb` rescue; PDF "Overall Assessment" | Not in wiki; required by Q4 |
| A6 (#16) | Stale fit/gap report served after portfolio changes | P1 | Broken | api | Candidate, HM | After a portfolio is regenerated, the old report (with levels and overrides that no longer exist) is still returned as current. | Portfolio E regenerated (1 skill), `POST /portfolios/:id/fitgap` returned 5 old skills; `portfolios_controller.rb` "no new overrides" comment not implemented | PRD-02 Phase 5 |
| A7 (code) | Taxonomy `skill_id` dropped when creating assessments | P2 | Broken | web, seam | Candidate | Skills match vacancies by label only, so a renamed label turns an assessed skill into "not assessed". | `SkillPicker.tsx:41` `skill_id: undefined`; `engine.rb` match by id then label. Code reading, not reproduced | PRD-02 Phase 1 (skill from taxonomy SK-ENG-001) |
| A8 (N17) | Clicking a level label in one skill changes another skill's expected level | P1 | Broken | web | Candidate, recruiter, HM | A label click in skill 3 silently changes the expected level of skill 1, so the wrong required level reaches the Fit/Gap report and the candidate is compared against a requirement nobody set. | `LevelRadio.tsx` fixed ids `level-1..5` since `ecce734`; red tests in `VacancyEditPage.test.tsx`, `AssessmentEditPage.test.tsx` | n/a (input bug) |
| A9 (N18) | A failed load shows an empty edit form that can be saved over the real record | P1 | Broken | web | Recruiter, HM, candidate | If a vacancy fails to load and the assessor fills in the title and saves, the culture and competency text used by the AI narrative is silently erased (for an assessment, the name and time limit are overwritten); existing skills survive because nested attributes need `_destroy`. | `.catch(() => {})` in `AssessmentEditPage.tsx` and `VacancyEditPage.tsx` since `ecce734`; red test `editFormFailures.test.tsx` | n/a (input bug) |

### B. Human authority and trail

| ID | Title | Sev | Kind | Layer | Harmed | Impact | Evidence / location | PRD |
|---|---|---|---|---|---|---|---|---|
| B1 (#10b) | Regeneration deletes assessor overrides | **P0** | Broken | api, data | Candidate, assessor | An assessor's correction disappears without trace and the candidate silently reverts to the AI rating. | `regen_check.rb`: 6 skills + 2 overrides become 1 + 0; `generator.rb` `destroy_all`; `has_one :assessor_override, dependent: :destroy` | Not in wiki; Q2 (history kept) |
| B2 (N12) | PDF export crashes for any overridden portfolio | P1 | Broken | api | HM, assessor | The moment a human corrects the AI, the official decision document cannot be produced. | `GET /portfolios/50/export?format=pdf` = 500; `pdf_generator.rb:85` uses "→", unsupported by Prawn's built-in font | PRD-02 Phase 5 (export PDF); Q4 |
| B3 (#4) | Override invisible in fit/gap | P1 | Broken | seam | HM, recruiter | A reader cannot tell which levels a human changed, so human review cannot be shown or audited. | Scenario E; API sends no `is_override`; `ComparisonTable.tsx:56` reads it | Not in wiki; Q2, Q4 |
| B4 (#15) | Override needs no note, cannot be undone, history overwritten | P1 | Missing spec | api, web | Candidate, assessor | There is no record of why a level changed, so human review cannot be evidenced under UU PDP Pasal 10 and 31. | `POST override {override_level: 1}` without notes = 201; no DELETE route; update overwrites previous values; `OverridePanel.tsx` "Notes (optional)" | Not in wiki; Q2 |
| B5 (Q4) | PDF does not carry decision states | P1 | Missing spec | api | HM | The official document has no "not assessed", no override history and no AI label, so it overstates certainty even when the screen is fixed. | `export_C.pdf` text (Step 2) | PRD-02 Phase 5; Q4 |
| B6 (#9) | Override deletes fit/gap reports before replacement exists | P2 | Broken | api, seam | Recruiter | An open report page drops to 404 and into the polling loop (D1) after every correction. | `portfolio_skills_controller.rb` `regenerate_stale_fitgap_reports` | Not in wiki |

### C. Data isolation and privacy

| ID | Title | Sev | Kind | Layer | Harmed | Impact | Evidence / location | PRD |
|---|---|---|---|---|---|---|---|---|
| C1 (#11) | Cross-organisation read and write | **P0** | Broken | api | Candidate, all orgs | Another company can export a candidate's full portfolio and overwrite their ratings, which is a notifiable breach under UU PDP Pasal 46. | Org B token: fitgap 200, export 200, override 201 on Org A data; `portfolios_controller.rb` `Portfolio.find` (lines 82, 104, 130, 156); `portfolio_skills_controller.rb:51`; `fit_gap_generator_worker.rb` `Vacancy.unscoped` | Not in wiki; code intends tenancy (`TenantScoped`) |
| C2 (N14) | No candidate notice or consent | **P0** | Missing spec | web | Candidate | Candidates are recorded, scored by AI and processed abroad without the information and explicit consent UU PDP Pasal 20 to 22 and 56 require. | Candidate page screenshot (Step 2) | PRD-02 Phase 2 (brief only) |
| C3 (#12) | Raw internal errors sent to client and logs | P2 | Broken | api | Candidate, operator | Exception text reaches the browser and logs; content leakage not observed with json 2.19 but depends on library and Gemini error bodies. | `generation_error` in responses; `http_client.rb` logs `response.body` | Not in wiki |
| C4 (N13b) | Candidate browser calls third parties | P2 | Missing spec | web | Candidate | The speed test sends the candidate's IP to httpbin.org, jsdelivr and google.com without notice. | Network log, `internetSpeedTest.ts` | Not in wiki |

### D. Invisible failure

| ID | Title | Sev | Kind | Layer | Harmed | Impact | Evidence / location | PRD |
|---|---|---|---|---|---|---|---|---|
| D1 (#7) | Polling re-enqueues jobs; endless spinner | P1 | Broken | web, seam | Recruiter, ops | A failing report spins forever while a new job is queued every 5 s (11 duplicates observed). | `FitGapReportPage.tsx` `fetchReport`; Sidekiq queue 2 to 7 in 24 s | Not in wiki |
| D2 (#8) | Fit/gap report has no status | P1 | Missing spec | data, api | Recruiter | "Generating", "failed" and "stale" cannot be represented, so the UI cannot tell users what is happening. | `fit_gap_reports` has no status/error columns | Not in wiki |
| D3 (#10a) | Portfolio written without transaction | P1 | Broken | api | Candidate | A mid-write failure leaves a partial portfolio (1 of 3 skills). | Scenario I; `generator.rb` `save_skills` | PRD-01 §5 |
| D4 (N4, N15) | Portfolio failure has no reason; list shows "Completed" | P2 | Broken | web, seam | Assessor | Assessors learn about failed portfolios only by opening each candidate. | Scenarios H, I; `/assessments/11/invite`; `PortfolioPage.tsx:170-184` | Not in wiki |
| D5 (N3) | Export errors unhandled in UI | P2 | Broken | web | Assessor, HM | A failed export shows nothing ("Uncaught (in promise)"). | Console on scenario H | PRD-02 Phase 5 |
| D6 (code) | Concurrent report generation can raise `RecordNotUnique` | P2 | Broken | api | Ops | Duplicate jobs from D1 can race on the unique index. | `engine.rb` `find_or_initialize_by` + `update!`. Code reading, not reproduced | Not in wiki |

### E. Candidate access and reach

| ID | Title | Sev | Kind | Layer | Harmed | Impact | Evidence / location | PRD |
|---|---|---|---|---|---|---|---|---|
| E1 (N13a) | Bandwidth gate blocks ordinary connections | P1 | Broken | web | Candidate | A 39/3.3 Mbps connection fails and "Start Interview" is disabled, although audio needs about 256 kbps. | `internetSpeedTest.ts:19-23`; `HardwareCheck.tsx:284` | PRD-02 Phase 2 |
| E2 (N8) | Invite link points to API host | P1 | Broken | api, ops | Candidate | Candidates receive a link to the backend instead of the interview page. | `session.rb:29` `APP_BASE_URL` | PRD-02 Phase 1 (app host link) |
| E3 (N14) | Candidate UI English-only | P2 | Missing spec | web | Candidate | Indonesian assessments greet candidates in English. | Candidate page; assessment `language: id` | Not in wiki |
| E4 (code) | 401 on candidate page redirects to assessor login | P2 | Broken | web | Candidate | A candidate with an expired or invalid link lands on an admin login. | `api.ts:29-33`. Code reading | Not in wiki |

### F. Fit/gap presentation

| ID | Title | Sev | Kind | Layer | Harmed | Impact | Evidence / location | PRD |
|---|---|---|---|---|---|---|---|---|
| F1 (#3) | Required column empty | P1 | Broken | seam | Recruiter, HM | The screen shows candidate levels with no requirement to compare against. | API `expected_level`, web `required_level` | PRD-02 Phase 5 U10 (Required column) |
| F2 (N5) | Mobile overflow and untruncated long text | P2 | Missing spec | web | Recruiter, HM | On a phone the page scrolls sideways and the header is cut off. | Scenario F at 390 px | Not in wiki |
| F3 (N2) | Discovered skill shows "2" instead of "L2" | P3 | Broken | seam | HM | Inconsistent level notation. | Scenario E | PRD-02 Phase 4 |
| F4 (N15) | "(expected )" label empty; tenant label hard-coded | P3 | Broken | web | Assessor | Cosmetic confusion. | `/assessments/11/invite`; `VITE_DEV_TENANT_NAME` | Not in wiki |

### G. Operational readiness

| ID | Title | Sev | Kind | Layer | Harmed | Impact | Evidence / location | PRD |
|---|---|---|---|---|---|---|---|---|
| G1 (N11) | Production cannot boot | P1 | Broken | ops | Everyone | `config.active_job` without the Active Job railtie raises at boot. | `production.rb:34`; local `RAILS_ENV=production` boot | n/a |
| G2 (Step 1) | Gemini configuration and capacity | P1 | Broken | api, ops | Candidate | Sample model names no longer exist; client pinned to `v1` (no preview/Pro models); 30 s hard-coded timeout; observed 403, 503 and timeouts, each ending in failed portfolios or silent fallbacks. | Step 1 and Step 2 logs | n/a |
| G3 (N7) | Deleting a session with a report fails | P2 | Broken | api, data | Assessor | `InvalidForeignKey`, no cleanup path. | Runner in rolled-back transaction | n/a |
| G4 | Setup and docs drift | P3 | Broken | ops | Developers | README model env name, port 3000 examples, `bin/rails` not executable, Procfile without `-C sidekiq.yml`, no seeded user, `.irbrc` column, `npm audit` 7 unreviewed. | Step 1 doc | n/a |
| G5 (resolved) | No tests, no CI, eager load failure | n/a | Broken | ops | Developers | Fixed in Step 1 (harness, CI, Zeitwerk mapping). | Commits `756d0e0` to `98aa8d8`, CI run 39976237381 | n/a |

**Count (excluding resolved G5), 37 findings:** P0: 4 (A1, B1, C1, C2). P1: 19 (A8 added in slice 7A, A9 in slice 7B). P2: 11. P3: 3.

---

## 5. Missing specification vs defective implementation

- **Missing spec (wiki silent, now decided or still open):** "not assessed" state (A1 part), confidence on fit/gap (A3 part), narrative provenance (A5), override rules, history and revert (B4), PDF decision states (B5), report status (D2), candidate notice and consent (C2), third-party calls (C4), candidate language (E3), mobile layout (F2). The wiki only describes a happy path where every skill is covered, the model never fails, nobody overrides and there is one tenant.
- **Defective implementation (defined, not working):** coercion to L1 against PRD-01's evidence rule (A1), schema not validated (A2), deterministic confidence rule from PRD-01 §5 not implemented (A3), summary and fallback ignore the engine's own `not_assessed` (A4), stale cache (A6), override wiped / invisible / crashing PDF (B1, B2, B3), tenant scoping bypassed (C1), polling loop and partial writes (D1, D3), Required column and invite host contradict PRD-02 (F1, E2), production boot (G1).
- **Conflict inside the wiki:** PRD-01's N10 prompt asks for a level for "EACH skill in the coverage map", including skills still `not_yet`, while the same section says to assign the level from consistent evidence. The prompt itself invites fabricated levels; fixing code alone is not enough.

---

## 6. API/web seam findings

The same data is computed in one layer and interpreted differently in another:

| Seam | API sends | Web/PDF expects or does | Effect |
|---|---|---|---|
| Fit/gap requirement | `expected_level` | Web reads `required_level`; PDF reads `expected_level` | Screen blank, PDF correct: the two decision surfaces disagree (F1) |
| Human override | Nothing (computed as `overridden`, not emitted) | Web reads `is_override`; PDF reads overrides directly | No marker on screen; PDF crashes on it (B2, B3) |
| Confidence | `confidence` (AI value even when overridden) | Web type has no field; PDF prints AI confidence | Hidden on screen, misattributed in PDF (A3) |
| Not assessed | `result: not_assessed` | Summary counts only match/gap/exceed | Unmeasured skills disappear from totals (A4) |
| Report lifecycle | 404 for both "not generated yet" and "generating"; no status | Page treats 404 as "trigger again" | Duplicate jobs, endless spinner (D1, D2) |
| Level format | Integer (`3`) | Type says string (`"L3"`); discovered skills rendered raw | "2" vs "L2" (F3) |
| Portfolio failure | Raw `generation_error` twice | Ignored; generic message | Leaky API, useless UI (C3, D4) |
| Session status | `failed` exists in enum | Web type lacks `failed`; list shows "Completed" by session status | Failed results look complete (D4) |
| Tenant | From JWT `scheme` | `VITE_DEV_TENANT_ID` never sent; header shows hard-coded name | Misleading tenant label (F4) |

Root cause pattern: there is no shared, typed contract for the fit/gap payload, and two renderers (React and Prawn) each re-derive presentation from different fields.

---

## 7. Constraint signal: memo to Tech Lead

**To:** Technical Lead. **Re:** blockers and decisions before the Portfolio, Override, Fit/Gap revamp ships.

1. **Tenant isolation (C1). Blocker.** Portfolio, PortfolioSkill and FitGapReport have no tenant column and four endpoints use `Portfolio.find`; another organisation can read and write candidate ratings. *Why escalate:* in production this is a UU PDP breach with a 3 x 24 hour notification duty (Pasal 46) and fines up to 2% of revenue (Pasal 57). *Decision needed:* fix scoping via `session.tenant_id` in the touched endpoints now, and decide whether to add a denormalised `tenant_id` later; check production logs for past cross-tenant access.
2. **Production boot (G1). Blocker.** `production.rb` calls `config.active_job` without the railtie. *Why:* either production runs a config not in this repo, or it cannot boot. *Decision:* confirm the deployed configuration; fix needs approval as a deploy file.
3. **LLM output contract (A1, A2, A3).** Model output is trusted without validation, and the N10 prompt asks for levels on unprobed skills. *Why:* every rating downstream depends on it. *Decision:* adopt a schema with an explicit "not assessed" outcome, compute confidence from coverage per PRD-01, and update the prompt; this is a product-visible change to the wiki spec.
4. **"Not assessed" semantics (Q1, decided).** Not assessed and low confidence never count as gaps and never enter recommendations; they are listed for follow-up. *Needs:* sign-off that this changes fit/gap totals for existing reports, and a backfill rule for historical portfolios that may contain coerced L1 values (cannot be distinguished after the fact).
5. **Report lifecycle (D1, D2, A6).** No status, stale cache, duplicate jobs. *Decision:* approve a schema change for report status and staleness; idempotent job enqueueing.
6. **Gemini capacity and configuration (G2).** Observed 403 (project denied), 503 (high demand), timeouts at 30 s, Pro quota 429, deprecated model names, `v1` pinning. *Why:* failures currently degrade silently into fallback text or failed portfolios. *Decision:* model choice and quotas per environment, timeout/retry budget, and whether to move to `v1beta` or Vertex; owner for the Google project.
7. **Human in the loop (Pasal 10, PP 33/2026 from 16 Jan 2027).** *Decision:* product policy that no hiring decision is made from AI output alone; overrides require a note (Q2) and are recorded; the PDF (official record, Q4) shows AI vs human.
8. **Candidate-side compliance (C2, C4, E1, E3; out of revamp scope per Q5).** No notice, consent, cross-border disclosure, Indonesian UI or realistic bandwidth threshold. *Why:* legal exposure sits with the client as controller but the product cannot support compliance today. *Decision:* schedule as the next track; DPIA (Pasal 34) owner.
9. **Data retention and candidate access (Q3, out of scope).** *Decision:* retention period for audio and transcripts, and how subject access/correction requests (Pasal 6, 7, 32) are served.

---

## 8. Scope line for the revamp

**In scope** (Portfolio, Override, Fit/Gap, PDF, and tenant isolation in touched endpoints):
A1, A2, A3, A4, A5, A6, B1, B2, B3, B4, B5, B6, C1 (portfolio, portfolio skill, fit/gap, export, worker paths), C3 (in those endpoints), D1, D2, D3, D4, D5, D6, F1, F2, F3.

**Out of scope, documented as follow-up:**

| ID | Reason |
|---|---|
| C2, C4, E1, E3 | Candidate consent, privacy notice, third-party calls, Indonesian UI and bandwidth threshold: product decision Q5 |
| E2, E4 | Invite and candidate-auth flow, outside Portfolio/Override/Fit-Gap; one-line fixes noted for the Tech Lead |
| G1 | Deploy configuration file; needs explicit approval |
| G2 | Provider, quota and timeout policy is an ops/product decision (memo item 6); the revamp only makes failures visible |
| G3, G4, F4, A7 | Outside the flow or low impact |
| Q3 items | Retention and candidate access: product decision Q3 |

---

## 9. Screenshot list (before fixes)

Local URLs from the current seed run (`bundle exec rails runner db/seeds/dev_scenarios.rb`); IDs change on every reseed, so re-read the seed output. All data is dummy ("Kandidat Contoh").

| # | Finding | Screen | URL / command |
|---|---|---|---|
| 1 | A1 | Portfolio C: "L1 Foundational, Confidence: HIGH" for empty levels | `http://localhost:5173/assessments/11/sessions/48/portfolio` |
| 2 | A1, B5 | PDF C: "Gap -2" for unrated skills | `GET /api/v1/portfolios/48/export?format=pdf&vacancy_id=16` |
| 3 | F1, B3 | Fit/gap E: empty Required, no override marker | `http://localhost:5173/assessments/11/sessions/50/fitgap/16` |
| 4 | A4 | Fit/gap B: "Match: 3 skills" with 2 not assessed, fallback "0 gaps" | `http://localhost:5173/assessments/11/sessions/47/fitgap/16` |
| 5 | A3 | Fit/gap D: low-confidence gaps identical to strong gaps | `http://localhost:5173/assessments/11/sessions/49/fitgap/16` |
| 6 | D1 | Network panel: GET 404 / POST 202 every 5 s; Sidekiq queue growing | Fit/gap A after an override: `http://localhost:5173/assessments/11/sessions/46/fitgap/16` |
| 7 | B2 | PDF export 500 for an overridden portfolio | `GET /api/v1/portfolios/50/export?format=pdf&vacancy_id=16` |
| 8 | C1 | Terminal: Org B token reading/writing Org A data (token masked) | `curl` with Org B JWT on `/portfolios/46/export?format=json` and `/portfolio_skills/<id>/override` |
| 9 | D4 | Portfolio H failed with no reason; list shows "Completed" | `http://localhost:5173/assessments/11/sessions/52/portfolio`, `http://localhost:5173/assessments/11/invite` |
| 10 | F2 | Fit/gap F at 390 px: horizontal overflow | `http://localhost:5173/assessments/11/sessions/51/fitgap/17` |
| 11 | C2, E1, E3 | Candidate page: English only, no notice, internet check "Failed" at 39/3.3 Mbps | `/interview/<token>` of dummy session 55 |
