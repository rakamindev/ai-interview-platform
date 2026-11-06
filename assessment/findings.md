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
| B7 | P2 | Ops | `VITE_DEV_TOKEN` would be baked into a production build if set | 📤 (verify the deploy config) |
| B8 | P3 | Ops | Sample config uses `ALLOWED_ORIGINS: "*"` | ⬜ |
| — | P0 | Ops | A real-looking API key was put into the tracked `.sample` file in the working copy | ✅ reverted before any commit; never in history |

## Release and boot
| ID | Sev | Type | Finding | Status |
|---|---|---|---|---|
| R1 | P0 | Defect | Production env config sets `config.active_job`, which isn't loaded, so production **does not boot** | ✅ unused setting removed; production boots locally (`r1-r2-boot.txt`) |
| R2 | P0 | Defect | Zeitwerk eager-load fails (`AudioWebsocketMiddleware` naming), so production **does not boot** | ✅ files renamed to match their classes; `zeitwerk:check` passes |
| R4 | P2 | Ops | k8s probes call plain-HTTP `/health` while production forces SSL (301); depends on cluster config | 📤 found during the R1/R2 smoke test |
| R3 | P2 | Ops | Cluster mode keeps per-process WebSocket state; reconnects may land on another worker | 📤 |
| E1 | P1 | Spec gap | No backend specs, no web test runner, no CI | 🟡 73 backend specs added; web runner and CI not yet |

## Assessment integrity (AI output and scoring lifecycle)
| ID | Sev | Type | Finding | Status |
|---|---|---|---|---|
| W10 / D4 | P0 | Defect | A late retry of an older job overwrote a newer report and deleted the assessor override (seen live) | ✅ G2 `a87c6ab`, G3 `1610cef` |
| D1 / W11 | P1 | Defect | A missing level became L1; an unconfigured skill was accepted; the skill id was invented | ✅ G1 (staged) |
| D1 / W13 | P1 | Defect | Quotes not in the transcript were accepted as evidence | ✅ G1 (staged) |
| D1 | P1 | Defect | Confidence was taken from the model instead of the PRD rule | ✅ G1 (staged) |
| D5 | P2 | Defect | A portfolio could be stuck "generating" forever after a worker crash | ✅ G2 |
| W7 / W8 | P0 | Defect | Scoring failed after a good interview (preview model on the hard-coded `v1` API; `gemini-2.5-pro` unavailable) with only "API returned 404" | 🟡 the failure is now classified and explained (needs admin); the hard-coded `v1` and dead code defaults are not fixed |
| W9 / D2 | P2 | Defect | A 503 was never retried (faraday-retry skips POST) | ✅ Sidekiq retries temporary errors with the right classification (G2) |
| M1–M3 | P0 | Ops | Configured models are unlisted, near shutdown (17 Nov), or auto-routed (1 Dec) | 📤 config choice; the failure path is now handled |
| M4 | P2 | Spec gap | No record of which model produced a report | ✅ requested and served model stored per generation (G2) |
| M5 | P3 | Defect | README documents `GEMINI_ANALYSIS_MODEL`, but the code reads `GEMINI_FLASH_MODEL` | ⬜ |
| M6 | P3 | Defect | Code fallback model ids are shut down or unlisted | ⬜ |
| D7 | P2 | Defect | Candidate speech isn't fenced off as untrusted in the scoring prompt (prompt-injection risk) | ⬜ |
| D6 | P3 | Defect | The portfolio can be scored before the last coverage updates land | 📤 |
| W14 | P3 | Observation | Two runs give different quotes and summaries | 📤 documented; model provenance recorded |

## Assessor workflow (UI and API seam)
| ID | Sev | Type | Finding | Status |
|---|---|---|---|---|
| W15 | P1 | Defect | Fit/gap "Required" column is blank (API sends `expected_level`, UI reads `required_level`) | ✅ fit/gap honesty commit |
| W17 | P1 | Defect | When the narrative AI call failed, a canned sentence was shown as if it were analysis | ✅ `narrative_status`; UI says the summary is unavailable |
| W20 | P0 | Defect | PDF export returns 500 (Prawn built-in font rejects non-Windows-1252 text) | ⬜ (button hidden in the new page; JSON export kept) |
| W16 | P2 | Defect | Fit/gap legend promises a ✏ override marker that never appears | ✅ `is_override` sent (older reports show it after regenerating) |
| W18 | P2 | Defect | The AI's "HIGH" confidence stays next to the human level after an override | ✅ new page explains confidence separately from the decision |
| W19 | P2 | Defect | A discovered skill at medium confidence was labelled "confirmed" in fit/gap | ⬜ |
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
| W27 | **P1** | Defect | **A skill listed twice in an assessment breaks every interview for it.** No uniqueness check on `skill_label`; `StartHandler` then hits the unique index on `coverage_maps` and the WebSocket closes | #148 | ⬜ |
| W28 | P2 | Defect | **Deleting an assessment that has sessions says "Assessment deleted" but deletes nothing.** `restrict_with_error` makes `destroy` return false, and the controller ignores it | #199 | ⬜ |
| W29 | P2 | Spec gap (UU PDP) | **Candidate speech is written to server logs.** `Gemini::LiveClient` logs up to 50 characters of each transcription (`inputTx=…`) at info level | #119 | ✅ `b421865` logs character counts only |
| W30 | P2 | Defect | **Fit/gap against a vacancy with no skills can never produce a report.** No comparisons → `skill_comparisons` presence validation fails → the job errors and retries | #122 | ⬜ (likely; not yet reproduced) |
