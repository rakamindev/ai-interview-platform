# Decision traceability: intent, evidence, mechanism and limits

This is a source-grounded retrospective decision map, not a fabricated contemporaneous record. The original assessment/decision-log.md remains authoritative for historical attributions. No claim is made that Farros personally reviewed or tested any new item until he does so.

## How a change earns its place

1. Name the affected user and the before/after behavior.
2. State the trigger: reproduction, source inspection, requirement or hypothesis.
3. Link the exact code/hunk and existing evidence.
4. State alternatives and why the selected scope is proportionate.
5. Record blast radius, risks, test result, unresolved ownership and a revisit trigger.
6. Reject unsupported numbers, guarantees or unrelated architectures.
7. Finish required artifacts; no practice begins until the user resumes it.

## Evidence vocabulary

**Observed/reproduced**: specific recorded failure. **Verified in source**: inspected mechanism, not runtime proof. **Recorded rationale**: explicitly present in earlier log. **Retrospective inference**: mechanism/rationale reconstructed now and labelled. **Hypothesis**: operational benefit or risk needing measurement. **Unknown**: missing approval, owner, data or original intent. Test count is not a coverage or business-impact metric.

## What we declined from the pasted AI advice

The 5W1H questions and proportionate decision records fit this task. The examples about 400% growth, Redis saturation, summary-tool retention, token savings, infinite JWT scale, 100% reliable formatting and five-year durability are unsupported example claims, not project data. A book summarizer, vector store, LangChain/provider factory, schema registry, new Git hooks and mandatory ADR for every typo have no demonstrated need in this case study. None was implemented. Logical/structural validation cannot prove semantic correctness.

## Narrative

Setup: an existing AI interview platform. Conflict: generated assessments may be unavailable, stale, misleading or lose human corrections. Choice: a verifiable scoring-to-decision slice. Mechanism: explicit generations, ownership, evidence states and retained human decisions. Proof: regression failures, seeded fault and real browser output. Limits: upstream quality, deployment, issuer, validity and business outcomes. Storyline helps readers follow evidence; it does not replace evidence.

## Decision records

### G2 — Number and gate scoring generations

**Intent / why:** An old retry could replace a newer published assessment.

**Evidence / historical record:** D-08, D-09, D-13 to D-17; journal §2

**What / how:** Create numbered generations, commit before enqueue, claim ownership and publish under the portfolio lock.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Latest-request-only discards useful success; delete/recreate loses continuity.

**Pros:** Protects published order and last good result.

**Cons / blast radius:** Adds rows, locks, recovery states, migration/storage and retry cost.

**How verified:** Lifecycle/concurrency specs; W10 red baseline; seeded fault.

**Evolvability / revisit trigger:** Revisit retry thresholds with queue/provider measurements; distributed delivery is not exactly once.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### G3 — Preserve human corrections and their basis

**Intent / why:** Regeneration or stale screens could erase or misrepresent human review.

**Evidence / historical record:** D-18 to D-23; journal §4

**What / how:** Resolve portfolio + skill_key, carry forward and flag changed/missing/conflicting basis under the same lock.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Fuzzy matching risks the wrong topic; blocking all re-score traps recovery; a full edit-event store is deferred.

**Pros:** Human level survives; seen basis remains distinguishable.

**Cons / blast radius:** More identity/conflict/review logic; not a complete immutable edit log.

**How verified:** Carry-forward and concurrency specs; migration evidence.

**Evolvability / revisit trigger:** Revisit if full per-edit audit requirements or skill-identity policy change.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### G1 — Validate AI assessment structure and source text

**Intent / why:** Missing level became L1 and unchecked words looked like candidate evidence.

**Evidence / historical record:** D-07, D-26; journal §6

**What / how:** Strict skill/level mapping, Not rated, deterministic quote states and coverage confidence.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Coercing to L1 invents capability; dropping gaps hides uncertainty; fuzzy verified wording overclaims.

**Pros:** Inspectable source references and explicit unknowns.

**Cons / blast radius:** Normalization can flag useful paraphrases; still cannot validate interpretation.

**How verified:** evidence_integrity_spec; G1 red/green and migration log.

**Evolvability / revisit trigger:** Revisit with expert evaluation and multilingual cases; matching never proves a correct rating.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### TENANT — Scope touched portfolio records to tenant

**Intent / why:** A valid foreign-tenant token could access guessed portfolio/override/vacancy IDs.

**Evidence / historical record:** D-22, D-24; journal §5

**What / how:** Load portfolio through session tenancy; fail closed when tenant missing; authenticate before tenant checks.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Per-action ad hoc filters duplicate risk; platform-wide tenancy redesign exceeds the bounded change.

**Pros:** Consistent scoped boundary for touched endpoints.

**Cons / blast radius:** Depends on trusted token issuance; B1 remains unresolved.

**How verified:** tenant_isolation_spec and recorded cross-tenant reproductions.

**Evolvability / revisit trigger:** Block rollout until issuer/membership integration is established; audit other scopes separately.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### FITGAP — Separate rule comparison from AI narrative

**Intent / why:** Required level was blank, override marker absent and failed narrative looked like analysis.

**Evidence / historical record:** Journal §7; W15-W17

**What / how:** Read expected_level, send is_override and store generated/unavailable narrative status.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Renaming the shared API field breaks other readers; a labelled canned count adds little value.

**Pros:** Essential role context visible; AI failure remains explicit.

**Cons / blast radius:** Stored snapshots can become stale; narrative validity remains outside this guarantee.

**How verified:** fit_gap_honesty_spec and inherited migration/browser evidence.

**Evolvability / revisit trigger:** Revisit snapshot provenance/invalidation and narrative contract with assessment owners.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### PDF — Render Unicode and preserve quote provenance

**Intent / why:** PDF returned 500 for observed Unicode; later inspection found unsupported text under Evidence.

**Evidence / historical record:** Journal §14; W20; continuation checkpoint

**What / how:** Embed licensed DejaVu; restore PDF action; label per-quote provenance and withhold not-found text.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Stripping characters loses information; merely returning 200 overlooks content integrity; full audit export deferred.

**Pros:** Real report downloads retain selected distinctions.

**Cons / blast radius:** Font weight/files and PDF-specific logic; arbitrary scripts and UI parity remain limited.

**How verified:** PDF request spec, four red/green provenance cases and genuine extracted/rendered browser PDFs.

**Evolvability / revisit trigger:** Revisit long documents, scripts and required audit/review fields before claiming portable record parity.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### UI — Make review signals understandable

**Intent / why:** Scores, confidence and many controls obscured assessor review needs.

**Evidence / historical record:** D-25; journal §10-11

**What / how:** Separate AI/human levels; attention items; expandable evidence; transcript anchors; responsive header.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Technical-first presentation overloads HR users; hiding tenant context loses company awareness.

**Pros:** Important exceptions can be found without showing all technical detail.

**Cons / blast radius:** More interaction state; no measured usability or workload improvement.

**How verified:** 15 portfolio logic tests; browser states and 375px captures.

**Evolvability / revisit trigger:** Validate realistic assessor tasks, keyboard/error/long-content behavior; avoid new design system.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### BOOT — Make existing production mode start

**Intent / why:** Unused Active Job config and Zeitwerk file/class mismatch stopped eager boot.

**Evidence / historical record:** Journal §8; R1/R2

**What / how:** Remove unused adapter setting and rename middleware files to match actual class names.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Loading unused framework or adding special inflections increases maintenance without need.

**Pros:** Existing stack can boot locally with its required configuration.

**Cons / blast radius:** Does not verify Docker, cluster, probes or live WebSocket behavior.

**How verified:** r1-r2-boot evidence; inherited Zeitwerk/local production smoke.

**Evolvability / revisit trigger:** Revisit with deployment owner and real environment/probe configuration.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### INVITE — Link candidates to the web application

**Intent / why:** Invite links targeted the API domain where the interview page does not exist.

**Evidence / historical record:** W25 and recorded Option A decision

**What / how:** Use configured WEB_APP_URL and validate it outside development/test.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Guessing origins at request time is deployment-dependent; hard-coded frontend host is inflexible.

**Pros:** Candidate invite opens intended frontend; invalid production setup fails early.

**Cons / blast radius:** Deployment must supply the right URL; no complete expiry/revocation lifecycle.

**How verified:** session_invite_url_spec and local production evidence.

**Evolvability / revisit trigger:** Revisit host/tenant/domain policy with deployment context.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### OUTCOME — Tell candidates the observed outcome

**Intent / why:** Invalid/failed sessions appeared as completed recordings.

**Evidence / historical record:** W26; journal §9

**What / how:** Map explicit end/link/error signals into truthful outcome screens.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** One generic success screen is misleading; guessing from an already-ended link overclaims completion.

**Pros:** Candidate receives a meaningful message and next action.

**Cons / blast radius:** Frontend signal correctness does not repair all upstream failure paths.

**How verified:** 11 interviewOutcome tests; invalid/ended browser screens; live interrupted state unverified.

**Evolvability / revisit trigger:** Revisit if backend adds richer completion/recording state.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### LOGGING — Remove speech from ordinary logs

**Intent / why:** Transcription snippets were logged at ordinary info level.

**Evidence / historical record:** W29; journal §9

**What / how:** Log character counts rather than the speech text.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Debug-only speech still exposes it when log level changes; removing all metadata loses operational signal.

**Pros:** Less unnecessary content exposure while retaining basic diagnostics.

**Cons / blast radius:** Not a complete logging, retention or privacy audit.

**How verified:** live_client_logging_spec; bounded source sweep.

**Evolvability / revisit trigger:** Revisit broader PII/telemetry policy before production.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### SETUP — Reject duplicate skills before interviewing

**Intent / why:** Setup/invite succeeded but duplicate coverage identity broke interview start.

**Evidence / historical record:** W27; journal §12

**What / how:** Validate normalized labels only when skill list changes; existing unrelated edits remain possible.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Runtime dedup hides setup errors; unique DB index needs production data cleanup policy.

**Pros:** User can correct configuration before inviting candidates.

**Cons / blast radius:** Existing bad configurations still need cleanup; picker still can propose duplicates.

**How verified:** Seven uniqueness examples, red controls and reproduction.

**Evolvability / revisit trigger:** Revisit database constraints only with real data/cleanup ownership.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### B7 — Exclude development auth from production usage and assets

**Intent / why:** Production could use development token; runtime-only guard still leaked synthetic token through whole env object.

**Evidence / historical record:** Current continuation; user authorized supported small fixes

**What / how:** Guard auth fallback with DEV and filter public build environment keys; preserve normal login storage.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Relying on deployment discipline alone leaks if misconfigured; runtime guard alone failed bundle proof.

**Pros:** Tested build neither uses nor embeds synthetic development credential.

**Cons / blast radius:** Public environment allowlist needs maintenance; stored login token/XSS/issuer risks remain.

**How verified:** Three auth regressions; failed pre-fix check; sentinel present after first attempt and absent after config correction.

**Evolvability / revisit trigger:** When adding public env settings, review exposure and update allowlist; do not infer full auth security.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### W28 — Report blocked deletion truthfully

**Intent / why:** destroy can return false because sessions restrict deletion, yet response reported success.

**Evidence / historical record:** Current continuation; historical W28 register

**What / how:** Return existing 422 error envelope when deletion is refused; preserve successful empty-assessment deletion.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Forcing cascade destroys interviews; always reporting 200 lies; changing frontend only hides backend contract.

**Pros:** Truthful API result; protected assessment/skills/session remain.

**Cons / blast radius:** Small response-contract change; frontend must display existing error envelope.

**How verified:** Three request cases: blocked/preserved, empty success, foreign-tenant 404; red 200 vs expected 422.

**Evolvability / revisit trigger:** Keep restriction policy; revisit archival requirements with product owner instead of deleting history.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### W19 — Use uncertainty wording for discovered skills

**Intent / why:** Medium/high confidence was presented as confirmed; missing levels could look blank.

**Evidence / historical record:** Current continuation; historical W19 register

**What / how:** Show AI suggested level or Not rated and coverage-confidence wording.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** A binary confirmed label conflates discussion coverage with validated competency.

**Pros:** Less misleading comparison presentation.

**Cons / blast radius:** No new semantic validity guarantee; browser/task evaluation remains bounded.

**How verified:** Source inspection, application types/build and actual synthetic fit/gap browser capture.

**Evolvability / revisit trigger:** Revisit language with assessor evaluation; no invented confidence probability.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### DOCS — Keep setup and comments aligned with code

**Intent / why:** Wrong model variable/path and recovery/save comments mislead setup and maintenance.

**Evidence / historical record:** Current continuation; M5 and stale comments

**What / how:** Document GEMINI_FLASH_MODEL, ../web and actual recovery/stale-screen rules.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** Leaving comments known-wrong increases investigation cost; broad renaming is unnecessary.

**Pros:** Reduces avoidable misunderstanding without changing behavior.

**Cons / blast radius:** Docs still cannot establish current provider availability or deployment setup.

**How verified:** Source comparison and git diff --check.

**Evolvability / revisit trigger:** Review at behavior/config changes; historical evidence stays dated.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### PROOF — Build bounded regression and demo evidence

**Intent / why:** Baseline had no specs or frontend runner and broad claims lacked regression proof.

**Evidence / historical record:** D-11; harness/demo/checkpoint records

**What / how:** Native RSpec/Vitest harness, controlled clients/jobs, red/green evidence and synthetic demo fixtures.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** A custom agent orchestration harness adds deadline/maintenance cost; happy-path-only proof misses failures.

**Pros:** Repeatable checks near the actual code; synthetic states protect candidate data.

**Cons / blast radius:** Test counts are not coverage percentages; fixtures are not live provider validation; CI remains absent.

**How verified:** Recorded checkpoint and seeded fault; final frozen acceptance is 105 backend examples / 29 frontend tests (evidence/checkpoint/freeze-verification.md).

**Evolvability / revisit trigger:** Add focused assertions on new failure evidence; measure performance before optimizing.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

### DELIVERY — Make the submission coherent and reviewable

**Intent / why:** Dense text plus screenshot appendix did not explain opportunity choice clearly; delivery links still missing.

**Evidence / historical record:** User-approved bounded report/learning work; blueprint

**What / how:** 14-page narrative with integrated evidence; maintain editable sources, explicit draft/disclosure and prioritized backlog.

**Who:** Historical choices are attributed to Engineer/AI as stated in the named decision log, not independently confirmed here. New continuation changes were proposed/executed by Codex under the user request; candidate review remains pending.

**When:** Historical stage and current continuation; current calendar date 6 Nov 2026. Commit chronology is listed below; no original timestamps or approvals are invented.

**Alternatives / decision:** More features delay required artifacts; unsupported business statistics create misleading authority.

**Pros:** Reviewers can follow user problem, decision, implementation, proof and boundary.

**Cons / blast radius:** Presentation cannot substitute for personal comprehension or mandatory PR/video delivery.

**How verified:** Render/text/link checks and candidate review pending; personal practice paused.

**Evolvability / revisit trigger:** Finalize only after real links/personal checks; no 1/3/5-year durability promise.

**Attribution limit:** Source-grounded synthesis. Per-file and per-hunk mapping below is retrospective inference, not evidence that the original author documented each line.

## Every changed file mapped

Mappings to a historical decision are inferred unless that record explicitly names the file. Multiple decisions may affect one hunk; the HTML/JSON index includes cross-cutting mechanism notes. Binary/font and prose/evidence changes are listed without pretending to explain binary lines.

| File | Decision group | Code hunks |

|---|---|---|

| `api/README.md` | DOCS | 0 |

| `api/app/channels/audio_web_socket_middleware.rb` | BOOT | 1 |

| `api/app/channels/coverage_web_socket_middleware.rb` | BOOT | 1 |

| `api/app/clients/gemini/http_client.rb` | G2 | 2 |

| `api/app/clients/gemini/live_client.rb` | LOGGING | 1 |

| `api/app/controllers/api/v1/assessments_controller.rb` | W28 | 1 |

| `api/app/controllers/api/v1/portfolio_skills_controller.rb` | DOCS | 3 |

| `api/app/controllers/api/v1/portfolios_controller.rb` | DOCS | 9 |

| `api/app/controllers/application_controller.rb` | TENANT | 1 |

| `api/app/models/assessment.rb` | SETUP | 1 |

| `api/app/models/assessor_override.rb` | G3 | 1 |

| `api/app/models/portfolio.rb` | DOCS | 1 |

| `api/app/models/portfolio_generation.rb` | G2 | 1 |

| `api/app/models/portfolio_skill.rb` | DOCS | 1 |

| `api/app/models/session.rb` | INVITE | 1 |

| `api/app/services/exports/pdf_generator.rb` | PDF | 4 |

| `api/app/services/fit_gap/engine.rb` | FITGAP | 5 |

| `api/app/services/portfolios/generator.rb` | G2 | 2 |

| `api/app/services/portfolios/provider_error.rb` | DOCS | 1 |

| `api/app/services/portfolios/quote_check.rb` | G1 | 1 |

| `api/app/services/portfolios/request_generation.rb` | G2 | 1 |

| `api/app/services/portfolios/save_override.rb` | G3 | 1 |

| `api/app/services/sessions/end_handler.rb` | G2 | 1 |

| `api/app/workers/portfolio_generator_worker.rb` | DOCS | 1 |

| `api/config/application.yml.sample` | DOCS | 0 |

| `api/config/environments/production.rb` | BOOT | 1 |

| `api/config/initializers/web_app_url.rb` | INVITE | 1 |

| `api/config/initializers/websocket.rb` | BOOT | 1 |

| `api/db/migrate/20261106100000_create_portfolio_generations.rb` | G2 | 1 |

| `api/db/migrate/20261106100001_backfill_portfolio_generations.rb` | G2 | 1 |

| `api/db/migrate/20261106120000_add_review_state_to_assessor_overrides.rb` | G3 | 1 |

| `api/db/migrate/20261106130000_add_evidence_integrity_to_portfolio_skills.rb` | G1 | 1 |

| `api/db/migrate/20261106140000_add_narrative_status_to_fit_gap_reports.rb` | FITGAP | 1 |

| `api/db/schema.rb` | DOCS | 6 |

| `api/k8s/configmap.yaml` | DOCS | 0 |

| `api/lib/tasks/demo.rake` | PROOF | 0 |

| `api/spec/clients/live_client_logging_spec.rb` | LOGGING | 1 |

| `api/spec/models/session_invite_url_spec.rb` | INVITE | 1 |

| `api/spec/rails_helper.rb` | PROOF | 1 |

| `api/spec/requests/assessment_skill_uniqueness_spec.rb` | SETUP | 1 |

| `api/spec/requests/evidence_integrity_spec.rb` | G1 | 1 |

| `api/spec/requests/fit_gap_honesty_spec.rb` | FITGAP | 1 |

| `api/spec/requests/override_carry_forward_spec.rb` | G3 | 1 |

| `api/spec/requests/override_concurrency_spec.rb` | G3 | 1 |

| `api/spec/requests/portfolio_generation_concurrency_spec.rb` | G2 | 1 |

| `api/spec/requests/portfolio_generation_lifecycle_spec.rb` | G2 | 1 |

| `api/spec/requests/portfolio_pdf_export_spec.rb` | PDF | 1 |

| `api/spec/requests/tenant_isolation_spec.rb` | TENANT | 1 |

| `api/spec/spec_helper.rb` | PROOF | 1 |

| `api/spec/support/test_data.rb` | PROOF | 1 |

| `api/vendor/fonts/DejaVuSans-Bold.ttf` | PDF | 0 |

| `api/vendor/fonts/DejaVuSans.ttf` | PDF | 0 |

| `api/vendor/fonts/LICENSE-DejaVu.txt` | PDF | 0 |

| `assessment/decision-log.md` | DOCS | 0 |

| `assessment/evidence/docker-smoke.txt` | DOCS | 0 |

| `assessment/evidence/g1-evidence-integrity.txt` | DOCS | 0 |

| `assessment/evidence/g1-migration-up-down-up.txt` | DOCS | 0 |

| `assessment/evidence/g3-migration-up-down-up.txt` | DOCS | 0 |

| `assessment/evidence/g3-overrides.txt` | G3 | 0 |

| `assessment/evidence/migration-up-down-up.txt` | DOCS | 0 |

| `assessment/evidence/r1-r2-boot.txt` | DOCS | 0 |

| `assessment/evidence/review-gaps-red.txt` | DOCS | 0 |

| `assessment/evidence/seeded-fault-w10.txt` | DOCS | 0 |

| `assessment/evidence/tenant-isolation.txt` | DOCS | 0 |

| `assessment/evidence/w10-green.txt` | DOCS | 0 |

| `assessment/evidence/w10-red-baseline.txt` | DOCS | 0 |

| `assessment/evidence/w17-migration-up-down-up.txt` | DOCS | 0 |

| `assessment/evidence/w20-pdf-export.txt` | DOCS | 0 |

| `assessment/evidence/w25-web-app-url.txt` | DOCS | 0 |

| `assessment/evidence/w26-end-screens.txt` | DOCS | 0 |

| `assessment/evidence/w27-repro.txt` | DOCS | 0 |

| `assessment/findings.md` | DOCS | 0 |

| `web/package.json` | PROOF | 2 |

| `web/src/components/fitgap/ComparisonTable.tsx` | FITGAP | 1 |

| `web/src/components/layout/AssessorLayout.tsx` | UI | 1 |

| `web/src/components/portfolio/ConfidenceIndicator.tsx` | UI | 0 |

| `web/src/components/portfolio/DecisionEditor.tsx` | UI | 1 |

| `web/src/components/portfolio/LevelBadge.tsx` | UI | 0 |

| `web/src/components/portfolio/OverridePanel.tsx` | UI | 0 |

| `web/src/components/portfolio/SkillPortfolioCard.tsx` | UI | 0 |

| `web/src/components/portfolio/SkillRow.tsx` | UI | 1 |

| `web/src/hooks/useAudioWebSocket.ts` | OUTCOME | 5 |

| `web/src/lib/interviewOutcome.test.ts` | OUTCOME | 1 |

| `web/src/lib/interviewOutcome.ts` | OUTCOME | 1 |

| `web/src/lib/portfolioReview.test.ts` | UI | 1 |

| `web/src/lib/portfolioReview.ts` | UI | 1 |

| `web/src/pages/fitgap/FitGapReportPage.tsx` | FITGAP | 2 |

| `web/src/pages/interview/InterviewPage.tsx` | OUTCOME | 7 |

| `web/src/pages/portfolio/PortfolioPage.tsx` | UI | 1 |

| `web/src/pages/transcript/TranscriptPage.tsx` | UI | 4 |

| `web/src/stores/authAtom.ts` | B7 | 1 |

| `web/src/types/index.ts` | UI | 4 |

| `web/vite.config.ts` | B7 | 2 |

| `api/spec/requests/assessment_deletion_spec.rb` | W28 | 1 |

| `web/src/stores/authAtom.test.ts` | B7 | 1 |

## Actual commit chronology

4da9c6b test: reproduce portfolio generation lifecycle regressions (W10)
a87c6ab feat: make portfolio generation lifecycle reliable
c31c334 docs: document seeded W10 fault verification
1610cef feat: preserve assessor overrides across generations
6ac277c fix: isolate portfolio and override endpoints by tenant
5f77f55 feat: validate AI portfolio output against evidence rules
35b227d fix: make the fit/gap report honest about levels and narrative
10b3a13 fix: let the API boot in production
b421865 fix: keep interview speech out of server logs
3f3746a fix: build candidate invite links from the web app URL
1861b3b fix: tell candidates what actually happened when the interview ends
c4b5a52 docs: record the timeboxed Docker image smoke attempt
f3942ef feat: redesign the assessor portfolio page around review and evidence
9d26128 chore: add synthetic demo data for every portfolio state
4fdc8aa docs: add the findings register
cc40520 fix: keep the assessor header on screen at phone widths
0ee9dbd fix: reject an assessment that lists the same skill twice
5b6e90c docs: record the attribution decision (D-27)
dfeb63a fix: export portfolio PDFs with any AI text
21bb9a1 feat: offer PDF download on the portfolio page again


## Current continuation boundary

New fixes and documentation remain uncommitted. No old commit/trailer was rewritten. Existing backup tags and user-owned dump/lockfile were preserved. Scope is the supplied branch and selected uncommitted work, not all conceivable future platform work. Candidate approval, actual deployment ownership and personal verification are not invented.

## Current independent check gap

Application TypeScript check and Vite build pass. An additional Vite-config TypeScript check (`npx tsc --noEmit -p tsconfig.node.json`) fails on missing Node path/__dirname declarations. The baseline already imported these Node facilities. This is tooling debt to resolve with an intentional Node type dependency/lockfile review, not a reason to falsify a passing result.

## Support-artifact code (outside the application repository)

- `Research/engineering/submission/build_report.py`: local ReportLab layout from editable report-pages.json. Intent: integrate genuine evidence with the explanation, reduce dense-text/screenshot-appendix separation, retain a visible draft and real-link gates. Trade-off: local builder maintenance and manual visual QA. Detail crops are presentation clipping in the PDF; original images remain unchanged. No product runtime or assessment behavior changes.
- `Research/engineering/learning/build_guide.py`, `assets/atlas.js` and `assets/atlas.css`: offline educational guide with local source excerpts, quizzes, state traces and an endpoint map. Intent: source-based explanation without production writes. Trade-off: illustrations simplify execution and are not live tests; browser layout was blocked from preview. Minimal isolated JS/HTML checks passed. User practice is paused; no mastery or personal checks asserted.
- `Research/engineering/defense/decision-traceability.html` and `.json`: generated retrospective review index. Intent: link meaningful code hunks to evidence and alternatives. Trade-off: grouped inference cannot recover undocumented original intent; no claim of contemporaneous line-by-line decisions. No Git enforcement hooks or new repository framework added.

## What data means here

Reproductions, response codes, failed assertions, database state, actual PDF parsing/rendering and a sentinel bundle scan are concrete evidence. Passing test counts establish only those test cases, not a coverage percentage or real-world incidence. Productivity, costs, SLAs, adoption, legal applicability and future scale remain unknown or proposed measurements. A testable acceptance criterion can justify a change without invented KPIs.

## Reconciliation with the supplied decision-audit framework

Source: `CaseStudy/Testing/rakamin_decision_audit_framework.md`, read in full during the continuation. It is explicitly a working draft based on agent updates, not an independent repository audit. Its example D-01..D-09 numbers are local to that document and must not replace the existing project D-00..D-34 IDs.

| Framework row | Existing project record / source | Reconciliation |
|---|---|---|
| 1 publication | D-08/D-09, G2, Generator#publish! | Source and regressions support the specific newest-successful invariant. No measured production incidence. |
| 2 concurrency | D-13, G2, Generator#claim!/lost_claim!/publish! | Lock, transaction and claim serve distinct purposes. Terminal-state gate also matters; simplified diagram omits it. |
| 3 human decisions | D-18..D-23, G3, SaveOverride | Preserve seen basis and stable identity; not a full immutable edit log or proof every assessment gets human review. |
| 4 uncertainty | D-07/D-26, G1, QuoteCheck/Generator | Rules are explicit, but threshold validity is not established; see heuristic audit below. |
| 5 comparison/export | FITGAP/PDF groups, journal §7/§14 | UI unavailable-summary and override marker must not be generalized to full PDF parity. |
| 6 dev-token build | D-29/B7, authAtom.ts and vite.config.ts | Runtime-only protection failed bundle inspection; final synthetic sentinel absent. No full issuer/token/sourcemap security audit claimed. |
| 7 deletion | D-30/W28, assessment_deletion_spec.rb | Red-before/green-after request proof exists; protected session/skills/assessment remain on refused deletion. |
| 8 confidence wording | D-31/W19, FitGapReportPage.tsx | Correct wording and source/application types/build/browser check. **No dedicated new W19 automated regression was added**; do not describe the three auth tests as label coverage. |
| 9 access/logs | D-24/TENANT, LOGGING and existing specs | Scoped touched endpoints and counts-only logs are bounded mitigations; B1 and governance remain open. |

### Three heuristic decisions requiring explicit humility

| Choice | What is actually recorded | Evidence boundary / future evaluation |
|---|---|---|
| 60% unique-word overlap | D-26 and QuoteCheck set the threshold for a suggested source location. A match is not declared. | No comparative experiment or documented numerical reason for choosing exactly 60 rather than 50/80 was found. Treat numerical selection as unrecorded/provisional. Evaluate candidate-language/length examples, false hints and missed locations before changing. |
| Coverage-derived confidence | D-26 follows the PRD rule: high for at least 3 probes and covered, medium for 2 or partial, otherwise low; overlapping conditions applied top-down. | This implements a specified rule, not an empirically calibrated competency-confidence probability. Expert validation and candidate-style comparisons remain open. |
| Six temporary-error retries | D-15 records an engineer choice and correction of mistaken backoff estimates; worker uses retry: 6 and classifies permanent/config failures separately. | No operational benchmark establishes six as cost/latency optimum. Measure recovery probability, request cost, queue time and actual service expectations. Execution time/jitter/queue delay prevent treating scheduled waits as an SLA. |

The 5W1H/TRACE–DECIDE wording is a local synthesis of useful reasoning questions. No claim is made that Google authored or endorsed that named method. Any future external-attribution paragraph requires checking the primary source first.

### Proportional documentation and delivery boundary

The 18 semantic records are the main engineering narrative. The 95-file/108-hunk explorer is a supporting navigation index, not 108 independent ADRs or a claim of 108 separately justified product decisions. Mechanical edits inherit the parent decision. Alternatives reconstructed today are contemporary evaluation candidates, not proof they were weighed historically; original intent/owner/date stay unknown where unrecorded.

Three audiences remain separate: the 14-page product case-study PDF; the technical decision/evidence record; and the optional learning guide. No new documentation framework, enforcement hooks, product feature or exercise is needed to accept these additions. Practice remains paused. The pending delivery gates are candidate review, intended-change commit, approved PR publication, recorded/approved video, actual links and final PDF/submission approval.

## Final freeze scope

The mappings above are a retrospective snapshot of the earlier continuation, not a complete index of later commits. Signed-tenant rationale and red/green proof are in `evidence/signed-tenant-contract.md`; final committed revision checks are in `evidence/checkpoint/freeze-verification.md`. The user approved local commits and implementation freeze after Claude's read-only review; this does not establish candidate-personal verification. No new implementation is authorized after freeze.
