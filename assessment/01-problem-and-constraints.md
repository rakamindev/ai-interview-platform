# Problem, gap, and constraints

**Hero theme:** Assessor Decision Confidence — portfolio → override → fit-gap as a hiring decision, not a dump of model output.

## Users

| Who | What they are trying to do |
|-----|----------------------------|
| Assessor (also recruiter / hiring manager in this app) | Decide whether a candidate is ready to progress, with a clear split between AI rating and human judgment |
| Candidate | Complete a fair interview. They did not choose this tool. A wrong status or a silent gap changes a real person's year |

There is no separate recruiter/HM role in the codebase. Those personas use the same assessor screens. Candidate fairness and UU PDP apply even though candidates never log in as admin.

## Current vs ideal (the gap)

**Current (before this slice):** After an interview, assessors opened portfolio and fit-gap to decide. Generation could look like “loading forever” (nil portfolio returned as generating). Failed runs did not always surface a usable error or retry. Fit-gap compared skills, but unassessed vacancy skills and human overrides were easy to miss. The frontend was loosely typed. There were no automated tests.

**Ideal:** In under two minutes an assessor can tell: (1) whether results are ready, (2) what the model is confident about, (3) what was never measured, (4) what a human overrode, (5) how that changes fit vs a vacancy — without mistaking a failed or partial run for a complete evaluation.

## Findings (missing spec vs defective)

| Sev | Finding | Type | Impact |
|-----|---------|------|--------|
| P0 | Portfolio failed / empty / generating states were not decision-safe | Defective + missing UX spec | Assessor can wait forever or hire off incomplete AI |
| P0 | Unassessed vacancy skills and overrides were not hard enough in fit-gap | Missing spec on the presentation seam | Candidate looks “complete” when coverage is a gap |
| P1 | `expected_level` vs `required_level`, `overridden` vs `is_override` | Defective contract | FE and API drift; comparison table lies |
| P1 | PDF export 500 on UTF-8 while JSON succeeded | Defective | Assessor cannot take the decision file after Gemini copy or a human override |
| P1 | No RSpec examples, no web test runner | Missing (called out in the brief) | Cannot prove the change |
| P1 | Candidate “complete” copy on `end_reason=error` | Defective | Unfair to the person who never chose the product |
| P2 | Vacancy skills with null `skill_id` broke prefill into “custom” | Defective | Assessor re-enters taxonomy they already defined |
| P2 | Hardware-check retry ignored in-flight loading | Defective | Candidate stuck on step 1 after retry |
| P3 | List search/filter density | Missing spec | Assessor friction on long lists, not a hiring-safety bug |

## Constraint signal (would escalate to a TL)

- **Gemini + Sidekiq + Redis:** portfolio/fit-gap generation is not a local HTTP happy path. Without a worker/key, the product must still fail cleanly. Live audio already used `v1beta`; the HTTP client was on `v1` and 404’d for current models.
- **JWT trust-without-DB:** assessor identity is the token claims. Tests stub auth; we did not invent a second user store.
- **Shared Postgres + `ai_interview` schema:** no new migration in this slice. Override/status already existed; we hardened behavior on top.
- **API `per_page` cap is 100:** list UIs walk `meta.total_pages`. Search/filter is client-side after that fetch — not a new search API.
- **Prawn Helvetica is Windows-1252:** JSON export is UTF-8 and worked. PDF uses AFM/Helvetica, so Gemini punctuation, evidence bullets, emoji, and the override arrow (`→`) 500 the request. This slice transcodes to Win1252 (unsupported glyphs → `?`) instead of vendoring a TTF. Full Unicode in the PDF is a follow-up.
- **UU PDP:** transcripts and export contain candidate data. Generation errors shown in UI are sanitized for key-like tokens. We do not log extra PII in this slice. Retention is assumed to stay with the existing platform.

## Assumptions (brief said to write them down)

- Recruiter/HM = assessor screens; no new RBAC.
- Empty session-with-no-portfolio-row still returns HTTP 202 `{ status: "generating" }` from the API. The FE treats a payload with no portfolio and no generating status as empty; in-flight work is the generating envelope.
- Invite email is out of scope (delivery + PDP). Assessor copies the link.
- “Unlimited list” means load every API page (100/row) and scroll at `60vh`, not raise the backend cap.
