# 01 — Discovery & Gap Analysis (static pass)

Status: static code + spec review, with **API running locally** (Ruby 3.3.2, Postgres 14,
Redis) on synthetic data. The live interview flow is not exercised yet (no Gemini key).
Findings marked **[VERIFIED]** were reproduced against the running API; *(to verify at runtime)*
still need a reproduction.

Sources: `api/`, `web/`, product spec in the repo wiki (PRD-01, PRD-02).

---

## 1. Core problem (one paragraph)

The product's output is a **per-skill level (L1–L5) that a recruiter uses to decide a real
person's hiring outcome**. The pipeline cannot represent "we did not gather evidence for this
skill". The spec only describes the happy path (every skill reaches `covered` before the
session ends). When a session ends early (`time_ceiling`, `error`, candidate hang-up, or the
unauthenticated `audio_complete` call), un-probed skills are still forced through the
portfolio prompt, and any missing or invalid level is silently coerced to **L1**. The fit/gap
engine then reports that fabricated L1 as a **Gap**, and the UI shows it with the same visual
authority as a well-evidenced rating. **The system turns "no evidence" into "evidence of low
skill" about a candidate who never chose this tool.** Everything else is secondary to that.

## 2. The evidence chain for the core problem

| Step | Code | What happens |
|---|---|---|
| Session ends before all skills covered | `sessions_controller.rb:118-128`, `audio_websocket_middleware.rb:387,510` | `time_ceiling` / `error` / `audio_complete` all end the session and enqueue N10 regardless of coverage. `audio_complete` hard-codes `reason: 'all_covered'` without checking coverage. |
| Prompt forces a level for every skill | `portfolios/generator.rb:81-91` | "For EACH skill in the coverage map… ASSIGN A LEVEL". No "not assessed" option, including for `state: not_yet, probe_count: 0`. |
| Missing level becomes L1 | `generator.rb:161,173` | `skill_data['level'].to_i.clamp(1, 5)`. Verified: `nil`, `"N/A"`, `"0"` → `1`. |
| DB cannot store "unassessed" | `schema.rb` `portfolio_skills.ai_level NOT NULL`, check 1..5; `PortfolioSkill` validates 1..5 | The model has no state for "no evidence". |
| Fit/gap reports it as a Gap | `fit_gap/engine.rb:46-50` | `not_assessed` only fires when the skill row is *absent*, never when it's present-but-unevidenced. L1 vs expected L3 → `gap, delta -2`. |
| Narrative amplifies it | `engine.rb:111-138` | LLM writes a "hiring recommendation" from those gaps. |
| UI presents it as fact | `SkillPortfolioCard.tsx:20`, `utils/constants.ts:4-8` | `parseLevel` also falls back to **1** on anything unparseable. The only signal is a "Confidence: LOW" dot, and confidence is LLM-self-reported. |

---

## 3. Findings by severity

Legend: **[SPEC]** = missing specification (never defined). **[DEFECT]** = defined but broken.

### P0 — wrong candidate outcome or data exposure

| # | Type | Svc | Finding | Impact (one line) |
|---|---|---|---|---|
| P0-1 | SPEC + DEFECT | api | Unassessed / invalid levels are coerced to L1 (`generator.rb:161,173`, NOT NULL `ai_level`). | A candidate who was never asked about a skill is reported as L1 and a hiring "Gap". |
| P0-2 **[VERIFIED]** | DEFECT | api | `Portfolio`, `PortfolioSkill`, `FitGapReport` are **not tenant-scoped**. `Portfolio.find(params[:id])` in `export`, `fitgap`, `show_fitgap`, `regenerate_fitgap`; `PortfolioSkill.joins(:portfolio).find` in `override`. | Any assessor of tenant A can download tenant B's candidate PDF (transcript quotes, assessment) or overwrite their ratings by iterating integer IDs. Cross-tenant personal-data breach (UU PDP). |
| P0-3 | DEFECT | api | `audio_complete` (no JWT, invite token only) ends the session as `all_covered` with no coverage check (`sessions_controller.rb:124-127`). | Anyone holding the invite link can end an interview early and label it "all covered", which feeds P0-1. |

### P1 — broken workflow or trust in the result

| # | Type | Svc | Finding | Impact |
|---|---|---|---|---|
| P1-1 | DEFECT | seam | API sends `expected_level`; web reads `required_level` (`types/index.ts:132`, `ComparisonTable.tsx:50`). | "Required" column is **blank in every fit/gap report**, so the recruiter can't see what the gap is measured against. |
| P1-2 | DEFECT | seam | Engine computes `overridden` but never emits `is_override`; web expects it (`ComparisonTable.tsx:56`). | Human overrides are invisible in the report; AI and human judgement are indistinguishable. |
| P1-3 | DEFECT | api+web | Portfolio save is not transactional: `destroy_all` then `create!` per skill (`generator.rb:154-178`). One invalid LLM field (`confidence: "very high"`, blank summary) raises mid-loop. | Partial writes. Retries (`retry: 3`) re-run the whole Gemini Pro call (180 s timeout) each time. |
| P1-4 | DEFECT | web+api | Duplicate fit/gap jobs: while `generating`, every 5 s poll gets 404 → calls `triggerFitGap` → enqueues **another** job (`FitGapReportPage.tsx:34-41`, `portfolios_controller.rb:122`). Concurrent `find_or_initialize_by` + unique index → `RecordNotUnique`. | N parallel paid LLM calls per report, plus spurious job failures. *(to verify at runtime)* |
| P1-5 | DEFECT | api | `EndHandler#call` checks `ended?` outside a lock; WS end + `audio_complete` can both pass and enqueue N10 twice. No unique index on `(portfolio_id, skill_label)`. | Duplicate skill rows / racing `destroy_all`. *(to verify at runtime)* |
| P1-6 | DEFECT | web | `overall_narrative` (the hiring recommendation) is only shown when `culture_narrative` is empty (`FitGapReportPage.tsx:173`). | The summary paragraph is effectively never displayed. |
| P1-7 | DEFECT | api | Fallback narrative ignores `not_assessed` (`engine.rb:141-147`). | When the LLM fails, the report says "2 matches, 1 gap" and silently drops unassessed skills. |
| P1-8 | SPEC | web | No candidate notice or consent before recording; the only mention is *after* the interview: "The interview has been recorded" (`InterviewPage.tsx:236`). | Personal data (voice, transcript) is processed without informed consent. UU PDP lawful-basis question → escalate. |

### P2 — degraded experience / hygiene

| # | Type | Svc | Finding | Impact |
|---|---|---|---|---|
| P2-1 | DEFECT | api | Non-JSON LLM output → `JSON::ParserError` whose message embeds the raw model text (candidate quotes) → stored in `generation_error`, logged, and returned by the API (`generator.rb:34-35`, `http_client.rb:78`). | Candidate content leaks into logs and error payloads. |
| P2-2 | DEFECT | web | Fit/gap page has no error or empty state: if the portfolio isn't complete or the trigger 4xx's, the page renders a header and nothing else. `PortfolioPage` swallows load errors (`.catch(() => {})`). | Blank screens with no explanation or next step. |
| P2-3 | DEFECT | web | Discovered skills in fit/gap print the raw level `3 (confirmed)`, and label `medium` confidence as "confirmed" (`FitGapReportPage.tsx:196`). | Overstates certainty. |
| P2-4 | DEFECT | web | Summary row omits the `not_assessed` count (`ComparisonTable.tsx:29-31`). | Unassessed skills disappear from the at-a-glance summary. |
| P2-5 | DEFECT | seam | `PortfolioSkill.ai_level` typed `string` ("L1") but the API returns an integer; masked by `parseLevel`. | Type lies hide P0-1 on the client. |
| P2-6 | DEFECT | api | `regenerate_fitgap` destroys the existing report *before* the job succeeds. | One failed regeneration loses the last good report. |
| P2-7 | SPEC | api | Confidence is self-reported by the LLM against a rule (`probe_count`, `state`) that is fully deterministic from `coverage_maps`. | Confidence can disagree with the actual coverage data. It should be computed, not generated. |

### P3 — polish

- Low-confidence banner copy is hard-coded in English; `assessments.language` exists (`id` locale likely).
- Long evidence quotes and labels have no truncation or expand behaviour; the table has `overflow-x-auto` but cards don't.
- "You Overridden ✓" copy (`OverridePanel.tsx:54`).
- `PortfolioPage` polls every 5 s with no back-off and no ceiling.

---

### Runtime reproduction of P0-2 (synthetic data, tenant A JWT, tenant B records)

```
GET  /api/v1/portfolios/1/export?format=json      -> 200, tenant B portfolio returned
POST /api/v1/portfolio_skills/1/override (L1->L5) -> 201, tenant B rating overwritten
GET  /api/v1/sessions/1  (control, TenantScoped)  -> 404 Session not found
```

The control shows that scoping works where `TenantScoped` is included. The leak is specific to
models that rely on it transitively.

## 4. Constraint signals (escalate to Tech Lead)

1. **Tenant isolation (P0-2) is a live breach risk.** It should ship as its own small PR first, independent of the revamp.
2. **No consent flow (P1-8).** Legal/product decision needed on lawful basis, retention period for transcripts and audio, and candidate access/correction rights. This is outside engineering's authority; I can only make the gap visible.
3. **Schema change to `portfolio_skills.ai_level`** (nullable + status column) touches the shared Postgres the README says is shared with `rakamin-api`. It must be confirmed that no other service reads this table with a NOT NULL assumption.
4. **Auth trusts JWT claims without a user lookup** (`authorize_api_request.rb:8`). A revoked user keeps access until expiry, and the sample config sets `TOKEN_EXPIRATION_TIME` to 259200 s (3 days).
5. **No tests, no CI, no web test runner.** Every fix above is unprotected against regression until the harness exists.
6. **Spec covers only the happy path** (PRD-02: "all covered before ceiling"). Behaviour for `time_ceiling` / `error` endings is undefined and is being decided implicitly by `.clamp(1, 5)`.

---

## 5. Proposed focus (to confirm after runtime validation)

**Make "not assessed" a first-class, honest state end to end.** Scope:

- **Backend (depth):**
  - Add an `assessment_status` to `portfolio_skills` (`assessed | insufficient_evidence | not_assessed`) and make `ai_level` nullable. The migration must be reversible and backfill existing rows as `assessed`.
  - Decide status deterministically from `coverage_maps` (`not_yet` → never sent to the LLM for a level).
  - Compute confidence from coverage instead of trusting the LLM.
  - Validate the LLM response with a schema; write atomically in a transaction; make the job idempotent and lock it.
  - Have fit/gap treat non-assessed skills as `not_assessed`.
  - Tenant-scope the portfolio endpoints.
- **Frontend:**
  - Add an explicit "Not assessed / insufficient evidence" card and comparison row: no fake L1, and a suggested next action such as a follow-up session.
  - Fix the `expected_level` and `is_override` seam.
  - Show the overall recommendation.
  - Cover all states (loading, empty, error, partial, long text, mobile).
- **Tests:** RSpec for the generator, engine, and request specs (tenant isolation). Vitest + Testing Library for the comparison table and skill card. GitHub Actions CI.
