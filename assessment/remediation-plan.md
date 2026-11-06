# Remediation and delivery plan - 6 November 2026

This is a prioritized inventory, not a promise to repair the whole platform before submission. The existing findings register remains the historical evidence index. Severity is impact; delivery order also considers evidence, dependencies and the chosen scope. Historical vendor/model claims require fresh verification and are not treated as current availability facts.

## A. Finish the case-study delivery first

| ID | Priority | Work | Evidence / acceptance | Boundary |
|---|---|---|---|---|
| SUB-01 | Submission blocker | Revise dense 20-page report into a coherent 13-16 page narrative | Opportunity choice, integrated screenshots, exact proof and honest limits | Local artifact edit; no publication |
| SUB-02 | Submission blocker | Candidate reviews intended diff and resolves local Git state | Deliberate commit includes only intended sanitized files; preserve existing history/tags | No push or PR without approval; dump and unrelated files never staged |
| SUB-03 | Submission blocker | Publish approved PR and add actual URL | Working PR on required repository/base with original description | Explicit approval needed |
| SUB-04 | Submission blocker | Record 3-5 minute video and obtain hosting URL | Real user journey + proof/limits, with fixtures identified and no secrets shown | Candidate narration/review; publication approval required |
| SUB-05 | Submission blocker | Finalize disclosure, links, PDF and submission | Candidate checks only personally completed facts; verify links and final render | Upload/submission require approval |
| SUB-06 | Important | Verify actual portal deadline | Existing notes report 7 Nov 18:00 WIB; printed brief differs | No portal authority/credentials assumed |

The personal learning guide is optional support, not a replacement for SUB-01..05. Practice remains paused at the user's request.

## B. Small confirmed fixes in this continuation

| Finding | Work and acceptance | Verification |
|---|---|---|
| W28 | Assessment with sessions returns 422 on blocked deletion; all related data remains. Empty assessment can still be deleted; foreign tenant cannot delete it. | Three request regressions: before fix 3 examples / 1 failure (expected 422, got 200). |
| B7 | Production auth ignores VITE_DEV_TOKEN while retaining stored login tokens and development fallback. Verify built assets contain no synthetic dev-token sentinel. | Three regressions: before fix 3 tests / 1 failure. Actual rebuilt asset scan passed after runtime guard AND build-time env allowlist; first runtime-only build leaked sentinel. |
| W19 | Replace "confirmed" discovered-skill label with AI suggestion / Not rated and coverage-confidence wording. | Type/build and source/browser check; no claim that a confidence value validates the rating. |
| M5 / documentation | Correct GEMINI_FLASH_MODEL name and ../web path; correct stale recovery/override comments. | Source review and diff check. Model availability itself remains unverified. |

Existing uncommitted PDF-provenance patch remains preserved. These changes add no schema, infrastructure, provider call or new product feature.

## C. Production blockers and broader reliability work

| Area / findings | Proposed bounded next step | Acceptance evidence | Why not silently fix now |
|---|---|---|---|
| B1 token tenant choice | Decide trusted issuer, membership source and local-login policy; stop caller-selected tenant authority in production | Adversarial login/token tests plus actual deployment integration | User has no tenant membership in this repository. Choosing first org or inventing membership would create false security. |
| W7/W8, M1-M3/M6 provider configuration | Verify available model/API version for authorized account; correct stale defaults/documentation only with verified facts | Actual authorized generation + classified failure; record version/account constraints | Needs provider access/budget; current examples and historical dates are not live availability proof. |
| C1/W6, C2/C3 reconnect and state | Reproduce timer/overlap defects with controlled connection loss; design ownership/cancellation and transcript guarantees | Live-audio/reconnect cases across refresh and worker placement | Significant state-machine change; do not claim portfolio publication fixes session lifecycle. |
| W4 quiet speech; W24 turn taking | Measure browser PCM/VAD and provider behavior with diverse audio cases | Quiet/normal/noisy inputs, pauses and accessibility task checks | Lowering a threshold blindly can add noise; real end-to-end audio evaluation needed. |
| W1/W2/W3 device checks | Use owned endpoints, measured byte counts and validated requirements; state third-party data flows | Network trace and low-bandwidth candidate flow | No invented speed threshold; product/accessibility/privacy decisions required. |
| B5 audio_complete | Establish a server-authorized completion handshake and distinguish manual end | Cannot claim all_covered with empty coverage; valid drain handshake still ends | Previous coverage re-check reportedly stalled completion; reproduce timing before changing. |
| C4/C5 session races/time limit | Use authoritative started_at/deadline and serialized start/end behavior | Concurrent start/end, refresh, silence and duplicate event tests | Portfolio concurrency safety is narrower than session safety. |
| D6 final coverage ordering | Define how scoring waits for or snapshots final coverage | Pending analyzer/ended-session regression without lost updates | May change queue and completion semantics. |
| R3/R4 deployment | Verify process routing/session state, Redis/DB, SSL and probe behavior in actual environment | Docker boot, health/auth/WebSocket and cluster checks | Requires infrastructure authority; local production boot is insufficient. |

## D. Integrity, user experience and additional product work

| Findings | Needed improvement | Acceptance / evidence | Priority / dependency |
|---|---|---|---|
| PDF parity | Render review-required state, earlier decisions, unavailable narrative and comparison override source consistently | Render/extract actual downloads for each state; distinguish snapshot from edit history | Important within selected workflow; unresolved, not complete audit record |
| Stale fit/gap | Define snapshot provenance/invalidation on portfolio publication; prevent silent stale comparison | New portfolio generation cannot masquerade as current comparison | Important; design failure/recovery before automatic regeneration |
| W30 | Reproduce empty-vacancy comparison failure, then validate setup or return explicit empty comparison policy | No endless retry for zero requirements; clear UI | Unreproduced hypothesis; diagnose first |
| W5 | Define whether draft zero-skill assessments are allowed; block inviting unusable configurations | Setup/invite errors understandable; existing draft edits preserved | Product rule and backwards compatibility needed |
| W12 | Reproduce lost taxonomy IDs from picker through payload/storage | Known taxonomy ID round-trips without fuzzy substitution | Targeted full-stack investigation |
| W22 | Check whether assessor page actually asks for microphone in current version | Browser permission/network inspection | Historical observation; not confirmed as current defect |
| W31 | Stop culture-fit claims from skills-only evidence; distinguish assessment scope | Controlled narrative fixtures/evaluation; UI labels | Prompt contract and assessment-specialist input; no fairness claims |
| D7 | Fence untrusted transcript content and validate output; evaluate adversarial transcripts | Prompt-injection test set; deterministic checks and limits | Important, but delimiters alone are not security proof |
| W23 | Agree interview depth/stopping policy and explanatory UI | Representative interviews show intended stopping criteria | Specification gap, not just changing probe count |
| B6 | Invitation expiry, revocation and connection ownership | Expired/revoked/duplicate connection tests | Requires policy and session compatibility decision |
| UX-01 | Keep export/review actions clear during slow requests; surface partial load/save errors | Keyboard + delayed/failed API cases; no duplicate/unintended action | Focused UX check, not a new design system |
| UX-02 | Verify loading/empty/error/long text/responsive/focus states of changed screens | Manual acceptance checklist and relevant UI integration cases | Existing helper tests are not full component/E2E coverage |

## E. Security and governance work

| Finding / area | What remains | Required decision / proof |
|---|---|---|
| B8 CORS | Replace wildcard example/deploy behavior with explicit allowed origins appropriate to environment | Read actual CORS config and deployment origins; do not assume sample value is production behavior |
| Tokens | Stored login tokens, token lifetime and browser security need review beyond B7 | Threat model/XSS and issuer/session decisions; no blanket move to cookies without integration design |
| TenantScoped | Generic default scope can fail open without tenant; touched portfolio scope explicitly fails closed | Audit other entry points/jobs deliberately; do not globally change scopes without preserving job behavior |
| Data lifecycle | Candidate notice, access/correction/challenge, retention/deletion, recording alternatives, processing roles/vendor flows | Product/legal/assessment owners establish policy and applicable obligations; not completed features |
| Validity and fairness | Provenance and stable storage do not establish meaningful competency measurement | Expert-reviewed evaluation across roles/languages/styles; no inferred discrimination or fairness claims |
| Secret scanning | Existing pattern checks are bounded; scan intended new changes/history and delivery media | Redacted review; exclude real PII, env, DB, dump and tokens; add a recognized scanner when available/authorized |

These are risk/ownership questions, not a legal compliance determination. Legal article and 2026 market claims pasted into chat need primary-source verification before inclusion.

## F. Performance and operating cost: measure before optimizing

No performance regression has been established by this audit. Do not label guesses as bugs or add caches/indexes/queues without evidence.

| Measurement | How to collect safely | Decision it enables |
|---|---|---|
| Portfolio/fitgap/export latency | Representative synthetic records; record size, query count, p50/p95 and rendering time | Identify actual serialization/query/render bottlenecks; avoid unmeasured N+1 claims |
| Queue completion time | Record queued/started/finished per generation and retry cause | Agree SLA and recovery thresholds; distinguish provider vs queue delay |
| Generation economics | Provider calls/retries, input size, infrastructure and assessor/recovery effort | Propose cost per review-ready assessment; no invented savings |
| Review usability | Same synthetic tasks with representative assessors; task success, error recognition, effort | Determine whether UI improves review rather than assuming shorter time is better |
| Storage/pagination | Growth of generations, transcript turns and comparisons; realistic record sizes | Determine retention/paging needs; no destructive cleanup without policy |
| Accessibility/low bandwidth | Keyboard/screen reader and throttled browser checks | Remove measured obstacles while preserving evidence access |

Proposed metric: cost per review-ready assessment = AI + infrastructure + review + recovery cost divided by review-ready assessments. Define denominator and SLA with stakeholders. Current project has no business baseline or achieved ROI.

## G. Test/release improvements

- Add minimal CI only after mandatory artifacts are secure; run meaningful backend/frontend/type/build checks with disposable Postgres/Redis. CI is currently absent, not merely unverified.
- Resolve frontend dependency lock deliberately. web/package-lock.json pre-existed untracked; no clean-install reproducibility claim until reviewed and committed with intended changes.
- Repeat broad tests once after bounded changes; use focused regressions while editing. Historical red/green evidence does not mean every AI-written line received independent review.
- Keep production rollout blocked on B1, provider/deployment verification and required organizational policies. Case-study submission can truthfully describe unresolved production risks.
- Finish PR/video/report first; no optional framework, database, observability platform or model rewrite is required for the selected case study.

## H. Cross-check of the original register

The rows below preserve the original register's unresolved/partial dispositions. They are inherited findings, not newly reproduced defects. Sections B-G state the current action. W19/W28/B7/M5 status may be advanced only after the continuation's checks are recorded.

| ID | Original severity/type | Historical finding | Disposition at audit start |
|---|---|---|---|
| B1 | P0 / Defect | The local `/auth/login` endpoint lets the caller choose the tenant in its token (`X-Tenant-Scheme`) | 📤 depends on how rakamin-api issues tokens |
| B5 | P2 / Defect | The candidate's invite token can end a session as `all_covered` with nothing covered | ⬜ |
| B6 | P2 / Spec gap | Invite tokens never expire, and there is no single-active-connection rule | 📤 |
| B7 | P2 / Ops | `VITE_DEV_TOKEN` would be baked into a production build if set | 📤 (verify the deploy config) |
| B8 | P3 / Ops | Sample config uses `ALLOWED_ORIGINS: "*"` | ⬜ |
| R4 | P2 / Ops | k8s probes call plain-HTTP `/health` while production forces SSL (301); depends on cluster config | 📤 found during the R1/R2 smoke test |
| R3 | P2 / Ops | Cluster mode keeps per-process WebSocket state; reconnects may land on another worker | 📤 |
| E1 | P1 / Spec gap | No backend specs, no web test runner, no CI | 🟡 96 backend examples and Vitest 26/26 pass at the Codex checkpoint; CI not added |
| W7 / W8 | P0 / Defect | Scoring failed after a good interview (preview model on the hard-coded `v1` API; `gemini-2.5-pro` unavailable) with only "API returned 404" | 🟡 the failure is now classified and explained (needs admin); the hard-coded `v1` and dead code defaults are not fixed |
| M1–M3 | P0 / Ops | Configured models are unlisted, near shutdown (17 Nov), or auto-routed (1 Dec) | 📤 config choice; the failure path is now handled |
| M5 | P3 / Defect | README documents `GEMINI_ANALYSIS_MODEL`, but the code reads `GEMINI_FLASH_MODEL` | ⬜ |
| M6 | P3 / Defect | Code fallback model ids are shut down or unlisted | ⬜ |
| D7 | P2 / Defect | Candidate speech isn't fenced off as untrusted in the scoring prompt (prompt-injection risk) | ⬜ |
| D6 | P3 / Defect | The portfolio can be scored before the last coverage updates land | 📤 |
| W14 | P3 / Observation | Two runs give different quotes and summaries | 📤 documented; model provenance recorded |
| W19 | P2 / Defect | A discovered skill at medium confidence was labelled "confirmed" in fit/gap | ⬜ |
| W22 | P3 / Defect | The assessor portfolio page asked for microphone access | ⬜ (check whether it still happens) |
| W12 | P2 / Defect | Taxonomy skill ids are lost when assessments and vacancies are created | ⬜ |
| W5 | P2 / Defect | An assessment with zero skills can be created and invited to | ⬜ |
| W31 | P2 / Spec gap | The fit/gap narrative asserts culture fit ("ownership-driven culture") that a skills-only interview never assessed | 📤 observed 6 Nov after the W17 fix; prompt contract is out of scope |
| W1 | P1 / Defect | The hardware check blocks Start below 4 Mbps up / 8 Mbps down (the real need is about 0.3 / 0.4); upload is measured against a US test server | ⬜ |
| W3 | P1 / Spec gap (UU PDP) | The candidate's IP is sent to 4 third-party sites before the interview, without notice | ⬜ |
| W2 | P3 / Defect | Hard-coded speed-test file sizes are wrong (1.2 MB counted vs 0.11 MB actual) | ⬜ |
| W4 | P1 / Defect | Quiet speech is dropped by a fixed silence threshold, so the AI never hears the candidate | ⬜ |
| C1 / W6 | P1 / Defect | A browser reconnect still ends the session 2 minutes later, marked "error" | ⬜ |
| C2 / C3 | P2 / Defect | A stale resumption handle can restart the interview; turns can be lost during a reconnect overlap | 📤 |
| C4 | P2 / Defect | Double end or start races | 🟡 the portfolio side is now safe (G2); the session side is not |
| C5 | P2 / Defect | The timer resets on refresh, and the time limit is only enforced on speech events | ⬜ |
| W23 | P2 / Spec gap | The time limit is only a ceiling; a skill counts as "covered" after 2 probes, so a 45-minute assessment ended in 3 minutes | 📤 |
| W24 | P2 / Spec gap | Silence-based turn-taking favours one talking style | 📤 |
| W28 | P2 / Defect | **Deleting an assessment that has sessions says "Assessment deleted" but deletes nothing.** `restrict_with_error` makes `destroy` return false, and the controller ignores it | ⬜ |
| W30 | P2 / Defect | **Fit/gap against a vacancy with no skills can never produce a report.** No comparisons → `skill_comparisons` presence validation fails → the job errors and retries | ⬜ (likely; not yet reproduced) |

## Stop conditions

For this continuation: complete three small source-backed corrections, their checks, the actionable inventory and the bounded PDF restructure. Leave broader work explicitly open. No push, PR creation, upload, deployment, live provider call, destructive Git or production-data mutation without the existing required approval. Personal practice remains paused.


## Latest results and added tooling finding

Bounded source fixes pass: 99 backend examples, 29 frontend tests, application TypeScript and Vite build. W19 synthetic browser view checked; synthetic development credential absent in final production assets. Separate `npx tsc --noEmit -p tsconfig.node.json` fails missing Node path/__dirname types; add proper Node dev types with intentional lockfile/dependency review, then rerun. Do not mask with fake ambient declarations. No production-readiness claim. See checkpoint/remediation-verification.md.

## Final code freeze disposition

The user approved committing the bounded PDF provenance, deletion response, development-token, fit/gap wording and documentation changes following Claude's provisional review. SUB-01 has a 14-page local review draft; SUB-02 is limited to the intended local commits. The pre-existing dump and lockfile remain untouched/untracked. Remaining rows are disclosed future work, not an instruction to continue implementation. Final acceptance results are in `evidence/checkpoint/freeze-verification.md`. PR/video/PDF delivery review is next; no publication is approved.
