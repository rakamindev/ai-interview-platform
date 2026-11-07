# Findings Register

Every problem found in the original code, with its evidence and its current status.

**Sources:** repository investigation (IDs R, B, C, D, M, E) and the end-to-end walkthrough (IDs W). Full write-ups are in the engineering notes; the evidence for anything fixed is in `assessment/evidence/`.

**Severity:**
- **P0**: breaks the product, or exposes or corrupts data.
- **P1**: misleads a user or blocks a core workflow.
- **P2**: degrades quality or robustness.
- **P3**: polish or hygiene.

**Type:**
- **Defect**: defined behaviour that is broken.
- **Spec gap**: behaviour that was never defined.
- **Ops**: configuration or environment.

**Status:**
- ✅ fixed and tested
- 🟡 partly addressed
- 📤 escalated (constraint signal, with a reason)
- ⬜ not addressed yet

## Security and data isolation
| ID | Sev | Type | Finding | Status |
|---|---|---|---|---|
| B2 | P0 | Defect | Another tenant could export or read portfolios and fit/gap by id (200) | ✅ `6ac277c`, tenant-isolation spec |
| B3 | P0 | Defect | Another tenant could write overrides on a candidate (201) | ✅ `6ac277c` |
| B4 | P1 | Defect | The vacancy id was not tenant-checked on fit/gap read and export | ✅ `6ac277c` |
| B1 | P0 | Defect | The local `/auth/login` endpoint lets the caller choose the tenant in its token (`X-Tenant-Scheme`) | 📤 depends on how rakamin-api issues tokens |
| B5 | P2 | Defect | The candidate's invite token can end a session as `all_covered` with nothing covered | ⬜ |
| B6 | P2 | Spec gap | Invite tokens never expire, and there is no single-active-connection rule | 📤 |
| B7 | P2 | Ops | `VITE_DEV_TOKEN` would be baked into a production build if set | ✅ runtime guard + production env allowlist; three auth regressions and sentinel bundle check. Stored-token/issuer security remains open |
| B8 | P3 | Ops | Sample config uses `ALLOWED_ORIGINS: "*"` | ⬜ |
| — | P0 | Ops | A real-looking API key was put into the tracked `.sample` file in the working copy | ✅ reverted before any commit; never in history |

## Release and boot
| ID | Sev | Type | Finding | Status |
|---|---|---|---|---|
| R1 | P0 | Defect | Production env config sets `config.active_job`, which isn't loaded, so production **does not boot** | ✅ unused setting removed; production boots locally (`r1-r2-boot.txt`) |
| R2 | P0 | Defect | Zeitwerk eager-load fails (`AudioWebsocketMiddleware` naming), so production **does not boot** | ✅ files renamed to match their classes; `zeitwerk:check` passes |
| R4 | P2 | Ops | k8s probes call plain-HTTP `/health` while production forces SSL (301); depends on cluster config | 📤 found during the R1/R2 smoke test |
| R3 | P2 | Ops | Cluster mode keeps per-process WebSocket state; reconnects may land on another worker | 📤 |
| E1 | P1 | Spec gap | No backend specs, no web test runner, no CI | 🟡 round-two acceptance: 112 backend examples, Vitest 29/29; results in evidence/checkpoint/council-round2-freeze-verification.md (historical freezes: 105/29, 107/29); application types/build pass; CI absent; separate Vite-config typecheck lacks Node types |

## Assessment integrity (AI output and scoring lifecycle)
| ID | Sev | Type | Finding | Status |
|---|---|---|---|---|
| W10 / D4 | P0 | Defect | A late retry of an older job overwrote a newer report and deleted the assessor override (seen live) | ✅ G2 `a87c6ab`, G3 `1610cef` |
| D1 / W11 | P1 | Defect | A missing level became L1; an unconfigured skill was accepted; the skill id was invented | ✅ G1 `5f77f55` |
| D1 / W13 | P1 | Defect | Quotes not in the transcript were accepted as evidence | ✅ G1 `5f77f55` |
| D1 | P1 | Defect | Confidence was taken from the model instead of the PRD rule | ✅ G1 `5f77f55` |
| D5 | P2 | Defect | A portfolio could be stuck "generating" forever after a worker crash | 🟡 G2 handles classified failures; unexpected first-scoring loss still has the Council A1 dead end below |
| W7 / W8 | P0 | Defect | Scoring failed after a good interview (preview model on the hard-coded `v1` API; `gemini-2.5-pro` unavailable) with only "API returned 404" | 🟡 the failure is now classified and explained (needs admin); the hard-coded `v1` and dead code defaults are not fixed |
| W9 / D2 | P2 | Defect | A 503 was never retried (faraday-retry skips POST) | ✅ Sidekiq retries temporary errors with the right classification (G2) |
| M1–M3 | P0 | Ops | Configured models are unlisted, near shutdown (17 Nov), or auto-routed (1 Dec) | 📤 config choice; the failure path is now handled |
| M4 | P2 | Spec gap | No record of which model produced a report | ✅ requested and served model stored per generation (G2) |
| M5 | P3 | Defect | README documents `GEMINI_ANALYSIS_MODEL`, but the code reads `GEMINI_FLASH_MODEL` | ✅ README corrected; provider availability not verified |
| M6 | P3 | Defect | Code fallback model ids are shut down or unlisted | ⬜ |
| D7 | P2 | Defect | Candidate speech isn't fenced off as untrusted in the scoring prompt (prompt-injection risk) | ⬜ |
| D6 | P3 | Defect | The portfolio can be scored before the last coverage updates land | 📤 |
| W14 | P3 | Observation | Two runs give different quotes and summaries | 📤 documented; model provenance recorded |

## Assessor workflow (UI and API seam)
| ID | Sev | Type | Finding | Status |
|---|---|---|---|---|
| W15 | P1 | Defect | Fit/gap "Required" column is blank (API sends `expected_level`, UI reads `required_level`) | ✅ fit/gap honesty commit |
| W17 | P1 | Defect | When the narrative AI call failed, a canned sentence was shown as if it were analysis | ✅ `narrative_status`; UI says the summary is unavailable |
| W20 | P0 | Defect | PDF export returns 500 (Prawn built-in font rejects non-Windows-1252 text) | ✅ `dfeb63a` font fix + `21bb9a1` button; browser downloads checked with/without vacancy. Checkpoint patch preserves quote provenance; see `evidence/checkpoint/verification.md` |
| W16 | P2 | Defect | Fit/gap legend promises a ✏ override marker that never appears | ✅ `is_override` sent (older reports show it after regenerating) |
| W18 | P2 | Defect | The AI's "HIGH" confidence stays next to the human level after an override | ✅ new page explains confidence separately from the decision |
| W19 | P2 | Defect | A discovered skill at medium confidence was labelled "confirmed" in fit/gap | ✅ replaced with AI suggestion / Not rated + coverage-confidence wording; source/types/build and synthetic browser check |
| W21 | P3 | Polish | "You Overridden ✓"; notes not shown after saving | ✅ new page |
| W22 | P3 | Defect | The assessor portfolio page asked for microphone access | ⬜ (check whether it still happens) |
| W12 | P2 | Defect | Taxonomy skill ids are lost when assessments and vacancies are created | ⬜ |
| W5 | P2 | Defect | An assessment with zero skills can be created and invited to | ⬜ |
| — | P2 | Spec gap | Fit/gap reports are not refreshed after a re-score | 📤 |
| W31 | P2 | Spec gap | The fit/gap narrative asserts culture fit ("ownership-driven culture") that a skills-only interview never assessed | 📤 observed 6 Nov after the W17 fix; prompt contract is out of scope |

## Candidate experience
| ID | Sev | Type | Finding | Status |
|---|---|---|---|---|
| W1 | P1 | Defect | The hardware check blocks Start below 4 Mbps up / 8 Mbps down (the real need is about 0.3 / 0.4); upload is measured against a US test server | ⬜ |
| W3 | P1 | Spec gap (UU PDP) | The candidate's IP is sent to 4 third-party sites before the interview, without notice | ⬜ |
| W2 | P3 | Defect | Hard-coded speed-test file sizes are wrong (1.2 MB counted vs 0.11 MB actual) | ⬜ |
| W4 | P1 | Defect | Quiet speech is dropped by a fixed silence threshold, so the AI never hears the candidate | ⬜ |
| C1 / W6 | P1 | Defect | A browser reconnect still ends the session 2 minutes later, marked "error" | ⬜ |
| C2 / C3 | P2 | Defect | A stale resumption handle can restart the interview; turns can be lost during a reconnect overlap | 📤 |
| C4 | P2 | Defect | Double end or start races | 🟡 the portfolio side is now safe (G2); the session side is not |
| C5 | P2 | Defect | The timer resets on refresh, and the time limit is only enforced on speech events | ⬜ |
| W23 | P2 | Spec gap | The time limit is only a ceiling; a skill counts as "covered" after 2 probes, so a 45-minute assessment ended in 3 minutes | 📤 |
| W24 | P2 | Spec gap | Silence-based turn-taking favours one talking style | 📤 |

## Found by checking where earlier PRs reported problems (verified in this repo; no code read or copied)
Earlier PR **titles** pointed us at these areas. Each one was then verified independently in this codebase. If we fix one, the PR that pointed us there is credited.

| ID | Sev | Type | Finding (verified here) | Pointed to by | Status |
|---|---|---|---|---|---|
| W25 | **P1** | Defect | **Invite links point at the API, not the web app.** `Session#invite_url` uses `APP_BASE_URL`, which defaults to `localhost:3001` (the API port) in the code and sample config. The k8s config sets it to `ai-interview-api.rakamin.com`. Candidates would get a link to a server with no `/interview` page | #11, #84, #128 | ✅ `3f3746a` WEB_APP_URL; production refuses to boot without it |
| W26 | **P1** | Defect | **The candidate is told "✅ Interview Complete — your interview has been recorded" when it wasn't.** This happens if the invite link is invalid or expired (`.catch → complete`), when the session ended with an error, and on any non-recoverable WebSocket error. The candidate leaves believing it worked | #8, #124, #221 | ✅ `1861b3b` honest outcome screens |
| W27 | **P1** | Defect | **A skill listed twice in an assessment breaks every interview for it.** No uniqueness check on `skill_label`; `StartHandler` then hits the unique index on `coverage_maps` and the WebSocket closes | #148 | ✅ reproduced (`w27-repro.txt`); duplicates rejected at save (422) |
| W28 | P2 | Defect | **Deleting an assessment that has sessions says "Assessment deleted" but deletes nothing.** `restrict_with_error` makes `destroy` return false, and the controller ignores it | #199 | ✅ blocked destroy returns 422; three deletion/access regressions; records preserved |
| W29 | P2 | Spec gap (UU PDP) | **Candidate speech is written to server logs.** `Gemini::LiveClient` logs up to 50 characters of each transcription (`inputTx=…`) at info level | #119 | ✅ `b421865` logs character counts only |
| W30 | P2 | Defect | **Fit/gap against a vacancy with no skills can never produce a report.** No comparisons → `skill_comparisons` presence validation fails → the job errors and retries | #122 | ⬜ (likely; not yet reproduced) |


Latest priorities and open work: `assessment/remediation-plan.md`. Decision rationale and inferred hunk mapping: `assessment/decision-traceability.md`. Original evidence remains dated; new tests do not establish complete security, usability or performance.

## Final freeze boundary

Signed-token HTTP tenant binding is committed in `3bc367b`; the issuer/membership B1 boundary remains a multi-tenant release blocker, escalated. Unexpected errors can still leave a run running; quote matching has no word-boundary constraint; coverage confidence ignores evidence-check quality; stored fit/gap can be stale. No additional fixes are authorized by the final code freeze. See `evidence/checkpoint/freeze-verification.md` for final results and version scope.

## Council review (post-freeze, 7 November 2026)

Council IDs below are reviewer-local IDs, qualified here to avoid confusing Council C1 with the original C-series findings. Severity and origin follow the council triage; these additional rows do not change the historical 56-finding or original-code P0 denominator. Round one moved the implementation from `3042704` to `2789bbc` with C1/A2; round two moves it to `2801058` with failure/reclaim R2 and A4 identity fixes. The remaining open rows are disclosures, not remediations. Source review is not execution proof. Gate provenance: [council freeze record](evidence/checkpoint/council-freeze-verification.md).

| Council ID | Triage severity | Origin | Finding / evidence | Status |
|---|---|---|---|---|
| C1 | P2 | Ours | Reclaim could change claim ownership after publication's check. A >10-minute provider call and a narrow publication race were required; this is same-run publication, not older-over-newer. `Generator#publish!`; real separate-connection regression `portfolio_reclaim_during_publish_spec.rb`. | ✅ `806d0e3`: generation row locked as well as portfolio; reclaimer waits then refuses completed run. [Red/green](evidence/council-c1-red-green.txt). |
| A2 | P1, conditional on colliding legacy rows | Ours | Backfill unique-key violation stops migration/deploy for normalized collisions such as C++/C#. `20261106100001_backfill_portfolio_generations.rb`; `portfolio_backfill_collision_spec.rb`. | ✅ `2789bbc`: first configured identity retained; normalized prefixed collisions, including empty labels, suffixed. [Red/green](evidence/council-a2-red-green.txt); up/down/up. Migration is new in this PR and has never run in production. |
| A1 | P1 | Ours (claim gate) + pre-existing (202 page) | After an unexpected error or killed worker on the first scoring, the immediate Sidekiq retry is a no-op; the page shows the spinner with no Retry button. API regenerate works after 10 minutes; there is no UI recovery path. `Generator#call/#claim!`, `RequestGeneration.regenerate_blocker`, portfolio 202 handling. Council triage: scratch re-run observed GET 202 before/after 11 min and POST regenerate 200 after 11 min. | ⬜ Disclosed; not fixed. Qualifies D5 above. |
| A3 | P2 | Ours | Missing provider key raises during generator initialization, before claim; run remains queued and regenerate returns 409. `Generator#initialize`, `Gemini::HttpClient#initialize`. Source review only in council triage. | ⬜ Disclosed; not fixed. |
| A4 | P2 | Ours | Colliding discovered keys could move C++ corrections to C#, redirect stale saves, find the wrong decision and silently drop a same-generation skill. `SkillIdentity.key` now compares equal keys plus labels after `strip.downcase.squeeze(' ')` for discovered skills; configured identity is unchanged. Used by carry-forward, both SaveOverride lookups and API orphan serialization. | ✅ `2801058`; [red/green](evidence/council-a4-red-green.txt), `discovered_skill_identity_spec.rb` (3 failures → 0; same-C++ control green both). Mismatches stay on original rows, flagged `skill_missing_in_current` and listed as earlier/orphaned decisions. Remaining limit: same-generation collision stores only one skill, records the other as `duplicate_discovered_identity`; punctuation variants (React.js / React JS) do not carry forward and are flagged instead. No key migration. |
| A5 | P2 | Ours | Valid JSON with no usable skills can publish all Not rated; existing report then blocks regenerate. `Generator#parse/#insert_skills!`, `RequestGeneration.regenerate_blocker`. Source review only. | ⬜ Disclosed; not fixed. |
| A6 | P3 | Ours | Empty provider response is classified as network_error rather than invalid output. Provider/client error classification; council source review only. | ⬜ Disclosed; not fixed. |
| A7 | P3 | Ours | Resolved conflict review flag can return on a later generation. Override carry-forward review state; council source review only. | ⬜ Disclosed; not fixed. |
| S1 | P2, conditional on other roles sharing signing secret | Pre-existing | Audio/coverage WebSockets check signature and tenant, not role: `AudioWebSocketMiddleware#authenticate_and_load`, `CoverageWebSocketMiddleware#authenticate_assessor_by_token`. Today upstream issues admin only per triage. | ⬜ Disclosed; not fixed. HTTP tenant fixes do not establish role authorization for these sockets. |
| S2 | P2 | Pre-existing | No filter_parameters configuration for invite tokens, passwords, names or notes; ordinary parameter logs can expose these. Council source/log review; not a fresh comprehensive log audit. | ⬜ Disclosed; not fixed. W29's speech-length fix is narrower. |
| S3 | P3 | Pre-existing | Invite holder can end a session through `SessionsController#audio_complete`. Source review; overlaps original B5. | ⬜ Disclosed; not fixed. |
| S4 | P3 (original triage; operational harm clarified) | Ours | `demo:portfolio_states:clear` is an operator-triggered, cross-tenant destructive task with no production guard (`api/lib/tasks/demo.rake`). It is not an externally callable endpoint. Source review. | ⬜ Disclosed; not fixed; production use can delete matching data across tenants. |
| S5 | P3 (original triage; auth consequence clarified) | Pre-existing | Signed scheme resolution uses `Organization.identify` (identifier/name/host/scheme/aliases and default-org fallback) in both tenant resolver and claim binding. A colliding identifier can resolve to the same wrong organization and satisfy both checks; an unknown signed scheme can hit the default org. Source review, not a new exploit run or production-leak claim. | ⬜ Disclosed; not fixed. Correct token issuer membership/ownership remains a separate unknown. |
| S6 | P3 | Pre-existing | Parse-error logs can include model text. Gemini client parse-error logging; council source review. | ⬜ Disclosed; not fixed. |
| C2 | P3 | Ours (wording) | “Skills outside the assessment rejected” was too broad: unknown configured skills rejected; extra skills kept as AI suggestions (`Generator#insert_skills!`). | ✅ PR wording corrected; no code behavior change. |

### Council round two — failure/reclaim and discovered identity

“Round-two R2” below is the council review ID, not the original boot finding R2. Scope and evidence: [round-two freeze record](evidence/checkpoint/council-round2-freeze-verification.md); [independent Claude gate summary](evidence/council-round2-gates-claude.txt).

| Council ID | Severity / origin | Correction and proof | Remaining boundary |
|---|---|---|---|
| Round-two R2 | Medium (source review); ours | ✅ `8e70fd7`: `Generator#fail!` takes the generation row lock after the portfolio lock, fencing failure against reclaim. `portfolio_fail_reclaim_spec.rb`: real two-connection assertion, B claim false, claim_count 1, A fails its own run. [Red/green](evidence/council-r2-fail-red-green.txt): 1 failure → 0. | Synthetic bounded race, not a stress/all-path lock-order proof. |
| A4 | P2 original triage; ours | ✅ `2801058`: label-aware comparison shared across carry-forward, stale saves, fallback lookup and orphan visibility. API assertions retain C++ L5/notes while C# stays unmodified. | Same-generation key collision is recorded but second row is not stored; canonical label rule is conservative, not semantic matching. A5 remains open. |

### Pack-3 source review — presentation and review-state limits

These are source-confirmed limits, not new browser executions or changes to the application. Source: `PortfoliosController#generation_json`, `PortfolioPage.tsx` earlier-decisions section, and `Generator#carry_overrides_forward!`.

- **Rejected colliding discovery not shown:** `generation.validation.rejected_skills` records `duplicate_discovered_identity`, but the portfolio API omits validation and the page does not show the rejection: server-side diagnostic only.
- **Earlier decisions visible, not resolvable:** the section shows skill and level ("Kept for the record"), not notes, reason or source run; there is no resolve/reattach action, and review routing ends there.
- **Review flag can clear automatically:** when an orphan's exact skill returns at the originally seen AI level (without conflicting history), carry-forward reattaches it and clears `needs_review` without acknowledgement; this is "reason resolved" behavior, while the product rule for human acknowledgement remains undecided.

"Flagged" for a missing skill therefore means shown as an earlier decision, not an in-page resolution workflow. Latest supplied raw Claude gate output at docs HEAD `fcf6619` / app `2801058`: [council-round2-gates-claude-raw.txt](evidence/council-round2-gates-claude-raw.txt). The earlier Claude gate file remains explicitly a summary. No new application/spec/config changes are part of this docs round.

## Farros’s own walkthrough — 7 Nov 2026

F1–F3 were found in Farros's own walkthrough, 7 Nov, on synthetic session 22. They are additional UX findings, outside the historical 56-finding/original-code P0 denominator. Fixed in `1e29ecd`; independently checked by Claude before fast-forward merge. [Agent browser measurements and gates](evidence/walkthrough-ux-check.md): portfolio and fit/gap at 375×812 and 1280×812, scrollWidth equals clientWidth; 112 RSpec examples/0 failures, 29 Vitest tests passed, TypeScript/build passed.

| ID | Class | Reproduction / observed problem | Status / correction |
|---|---|---|---|
| F1 | UX defect | Open a portfolio skill: the decision action was a small teal text link below the evidence, hard to find. | ✅ Fixed: `SkillRow.tsx` shows an outlined pencil button next to the decision record, inside the opened skill. Change decision / Set your level / Set level; flagged Keep/Change controls retained. |
| F2 | UX defect | Scroll to portfolio actions: vacancy comparison, PDF, JSON and transcript were mixed in one row. | ✅ Fixed: `PortfolioPage.tsx` separates Compare with a role from Share or check the source; comparison has helper text and a primary action enabled after vacancy selection. |
| F3 | Responsive defect | Open fit/gap at phone width: title and actions competed in a non-wrapping header. | ✅ Fixed: `FitGapReportPage.tsx` stacks the header and wraps buttons on mobile; desktop remains one row. Existing comparison table scroll wrapper retained. |
