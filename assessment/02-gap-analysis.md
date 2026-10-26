# Step 3 — Problem & Gap to Ideal Condition

## Core problem

> **The Fit/Gap report — the one artefact a hiring manager acts on — cannot be trusted.** It shows blank required levels, hides which numbers a human corrected, presents missing or thin evidence as a "gap", can disappear or spin forever, and can be read across companies.

Ideal condition: every row on the Fit/Gap screen is (1) correct against the API, (2) honest about its certainty and provenance (AI vs. assessor, high vs. low confidence, assessed vs. not), (3) always in a defined state (ready / generating / failed / outdated), and (4) visible only to the tenant that owns the candidate.

How evidence was gathered: ran both services locally on fictional two-tenant data, called the API directly, inspected `fit_gap_reports` rows and Sidekiq logs. Raw outputs: [`evidence/api-01-baseline-payloads.txt`](evidence/api-01-baseline-payloads.txt), [`evidence/web-01-seam-bug-red.txt`](evidence/web-01-seam-bug-red.txt).

## Findings

Type: **D** = defective implementation (defined, broken) · **M** = missing specification (never defined).

| # | Sev | Type | Service | Finding | Impact on real workflow |
|---|---|---|---|---|---|
| F0 | **P0** | D | api | The API cannot boot in production: `production.rb` configures Active Job (never loaded) → `NoMethodError`; once removed, eager loading fails on `AudioWebsocketMiddleware` (file name vs. `WebSocket` acronym). Found when CI eager-loaded the app. Evidence: [`evidence/api-05-production-boot.txt`](evidence/api-05-production-boot.txt). | Nothing ships. A release blocker independent of any feature work. |
| F1 | **P0** | D | api ↔ web seam | API serialises `expected_level`; web reads `required_level`. "Required" column is blank on every row. PDF export reads `expected_level`, so screen and PDF disagree. `tsc` passes — the web type mirrors itself, not the API. | Assessor cannot see what the role requires on the very screen meant to compare it. |
| F2 | **P0** | D | api | `POST /portfolios/:id/fitgap`, `GET …/fitgap/:vacancy_id`, `POST …/regenerate_fitgap`, `GET …/export` use `Portfolio.find` with no tenant check. Verified: tenant A exported tenant B's portfolio incl. evidence quotes (HTTP 200) and persisted a cross-tenant report. `PortfolioSkill` override has the same hole. | Candidate data of one company readable/writable by another — UU PDP confidentiality breach. |
| F3 | **P1** | D | api ↔ web | Override does `report.destroy` + enqueue. Verified: report returns 404 immediately; the page reacts to 404 by enqueuing *another* job → duplicate jobs (4 jobs for 2 requests). If the job fails, the report is gone. | Assessor sees the report vanish after correcting a level; workers race on the same row. |
| F4 | **P1** | D | api ↔ web | `is_override` never serialised; web shows ✏ only if it exists. Verified: after overriding Communication 2→3 the row says "match" with no marker. | Hiring manager cannot tell human judgement from AI output; assessor cannot audit their own corrections. |
| F5 | **P1** | M | api ↔ web | No lifecycle state for reports. Worker failure leaves no row; the page polls every 5s forever with "Generating…". | Infinite spinner; no retry path; assessor abandons the tool. |
| F6 | **P1** | M | api | Low-confidence ratings (1 probe) produce a hard "gap", identical to a high-confidence gap. Verified: Communication L2 *low* → "gap". | Candidate penalised for the interview running short, not for lacking skill. |
| F7 | **P1** | M | api ↔ web | `not_assessed` omitted from web summary counts and from the fallback narrative ("1 matches, 1 exceeds, 1 gaps" while Kubernetes was never assessed). | Reader assumes full coverage; missing evidence silently becomes absence of skill. |
| F8 | **P1** | D | api | Portfolio regeneration `destroy_all`s skills → overrides cascade-deleted, outside a transaction. | Human corrections silently lost; partial portfolio if the model call dies mid-write. |
| F9 | **P2** | D | api ↔ web | Narrative: prompt omits competency summaries (PRD-02 says include them); JSON not validated; asks for a "hiring recommendation"; web shows `culture || overall` so `overall_narrative` is hidden when both exist; no flag for AI vs. fallback text. | Unverifiable AI text framed as a decision (UU PDP automated-decision concern). |
| F10 | **P2** | D | api | Skill matching by `skill_id` or exact `downcase` label — whitespace/punctuation variants become false `not_assessed`. | Spurious "not assessed" rows. |
| F11 | **P2** | M | web | UI states: emoji as icons, no error/failed/empty/outdated state, no provenance (generated at, source), no long-label handling, table-only layout on mobile. | Unpolished, hard to read on a phone where hiring managers read it. |
| F12 | **P2** | M | api | No `filter_parameters`; `candidate_name`, `invite_token`, transcript text can reach production logs. | PII in logs (UU PDP data minimisation). |
| F13 | **P3** | D | api | Duplicate index on `coverage_maps.session_id`; LLM `confidence` not normalised (case) before an enum insert. | Minor waste / avoidable job failure. |
| F14 | **P3** | M | both | No specs, no web test runner, no CI. | Regressions like F1 ship unnoticed. |

## Constraint signal — what I would escalate to the Tech Lead

1. **Release blocker (F0).** `main` cannot boot with `eager_load = true`. Fixed here with a one-line config removal and a Zeitwerk inflection, but it means production has not been deployed from this tree, or is deployed with a config not in the repo — needs confirming before any release.
2. **Tenancy model is fail-open.** `TenantScoped` falls back to `all` when no tenant is resolved, and `Portfolio`/`PortfolioSkill`/`FitGapReport`/`AssessorOverride` carry no `tenant_id` at all. Fixing F2 per endpoint is necessary but not sufficient; the long-term fix (tenant_id on every table + fail-closed scope + Postgres RLS) is a cross-team decision.
3. **Tenant resolved from an unverified JWT decode.** `TenantResolverMiddleware` uses `decode_without_verification`; it is safe today only because `AuthTokenMiddleware` verifies afterwards on assessor routes. Any route without `authorize_auth_token!` trusts a forged `scheme`.
4. **No data retention / deletion path** for transcripts, audio-derived text and portfolios (UU PDP right to erasure). Needs a product + legal decision.
5. **Deadline ambiguity.** Brief says Wednesday 19 August 13:00 WIB; working date is 23 October 2026. Assumed the portal deadline governs.

## Scope decision

This PR fixes F0, F1–F7 and F9–F11 end to end (the Fit/Gap slice), plus F2 for every portfolio/override endpoint and F12. F8 is mitigated by preserving overrides across regeneration; F13 and the tenancy re-architecture are documented, not fixed.
