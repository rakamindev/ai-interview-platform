# Step 4: Strategy

## The decision in one paragraph

Make the result pipeline **honest about what it didn't measure**, end to end. A skill the interview never reached,
or that the model couldn't rate, is stored as *not assessed* (no level), not as L1. It reaches fit/gap as *not
assessed*, not as a gap, and the assessor sees a clear "not assessed" state that says why, instead of a level badge.
Along the way, the portfolio write becomes atomic, keeps the assessor's overrides, accounts for every configured
skill, and drops evidence quotes that aren't in the transcript. The fit/gap screen's broken required-level column is
fixed. Cross-tenant access on the three endpoints this work touches ships as a separate, small PR.

## Why this, and not something else

From [02-domain-immersion.md](02-domain-immersion.md) and [03-problem-and-gap.md](03-problem-and-gap.md):

- **Impact.** The rating is the product. A fabricated L1 is a silent false low: a qualified candidate is rejected
  for a skill nobody asked about, and no one finds out (Step 2, Pillar 3).
- **Who it hurts.** It hurts the candidate most, for doing something the product offered: "You can end anytime"
  (Pillar 5). It hurts the assessor and the hiring manager, who can't tell measured-low from never-measured
  (Pillar 4). And it confirms the market's top objection to AI hiring, "errors caused by AI" (Pillar 2).
- **Reach.** It's one defect with four symptoms across both services: the generator clamp, a `NOT NULL 1..5`
  column, the fit/gap verdict, and the web's `parseLevel` fallback. Fixing one layer leaves the others lying.
- **Testability.** It can be fully verified without a live model. The pipeline starts from a model *response*,
  which the test harness already stubs. A voice-interview change couldn't be verified this way (constraint C1).

**What I considered and set aside:**

- **Candidate notice and consent (P2-4).** High value (UU PDP Art. 20–22), but it's mostly copy and a legal decision
  (who the controller is, which lawful basis applies) that I can't make alone. It's the recommended next change;
  see "Follow-ups".
- **Assessment list (P1-8, P1-9, P2-6..P2-9).** Real friction, but it costs time rather than producing wrong
  outcomes.
- **Tenant isolation (P0-2).** It's a P0, but it's a security fix, not a product decision. It's small and
  mechanical, so it ships as its own PR instead of competing for this one's scope (see "Delivery").

---

## Acceptance criteria

Written before any code. Each one names the test that proves it. **(pending)** means a spec already exists in the
harness and fails today; the others are new.

### Backend: portfolio generation (`Portfolios::Generator`)

| # | Given | Then | Test |
|---|---|---|---|
| AC-1 | The model returns `level: null` for a skill | It's stored with no level (`ai_level` NULL), marked not assessed with reason `insufficient_evidence`. Never L1. | generator spec, P0-1 **(pending)** |
| AC-2 | The model returns a level for a skill whose coverage state is `not_yet` (never probed) | The level is discarded and the skill is stored as not assessed, reason `not_reached`. The coverage map overrides the model: a rating with zero probes has no evidence by definition. | new |
| AC-3 | The model returns `"3"`, `"L3"`, `3.0` or `3` | Stored as 3. | new (table-driven) |
| AC-4 | The model returns `0`, `6`, `-1`, `"N/A"`, `"high"`, `true`, `[]`, `{}` or an empty string | Stored as not assessed, reason `insufficient_evidence`. Never clamped into range. | new (table-driven) |
| AC-5 | The model leaves out a configured skill | That skill still appears, as not assessed with reason `omitted_by_model`. Every configured skill has exactly one row. | generator spec, P1-3 **(pending)** |
| AC-6 | The model returns a skill twice, or a "configured" skill that isn't configured | Duplicates are collapsed to the first entry. An unknown "configured" skill is stored as discovered, not dropped. | new |
| AC-7 | An evidence quote doesn't appear in any **candidate** turn of the transcript (after normalizing case, whitespace and quote marks) | The quote is dropped. If a rated skill ends up with no verifiable quotes, it keeps its level but its confidence is lowered to `low`. | generator spec, P1-5 **(pending)** + new |
| AC-8 | Any entry fails validation partway through a write | Nothing changes: the previous skills, if any, are still there, and the portfolio is marked `failed`. | generator spec, P1-4 **(pending)** |
| AC-9 | A portfolio is regenerated after the assessor overrode a skill | The override survives on the skill with the same identity (`skill_id`, else label). An override on a skill that disappears is kept and reported, not silently deleted. | generator spec, P1-4 **(pending)** |
| AC-10 | The model call times out, returns invalid JSON, or returns JSON without `configured_skills` | The portfolio is `failed` with an error **category** (`model_timeout`, `model_invalid_response`, …), and existing skills are untouched. The raw model text is never stored in `generation_error` or logged. | new |
| AC-11 | An evidence quote or summary is very long (e.g. 20,000 characters) | Quotes are capped at 500 characters and the summary at 2,000, each with an ellipsis. The write doesn't fail. | new |
| AC-12 | A not-assessed skill | `ai_confidence` and `competency_summary` are NULL. Confidence is meaningless with no rating. | new |

### Backend: fit/gap (`FitGap::Engine`)

| # | Given | Then | Test |
|---|---|---|---|
| AC-13 | A vacancy skill whose portfolio skill is not assessed | `result: not_assessed`, `candidate_level: null`, `delta: null`. Not a gap. | engine spec, P1-1 **(pending)** |
| AC-14 | A not-assessed skill the assessor has overridden | The override counts: it's compared like any rated skill, and the comparison carries `is_override: true`. | new |
| AC-15 | Any comparison | It carries `expected_level`, `required_level` (same value, kept for compatibility during the transition), `is_override` and `confidence`. | new |
| AC-16 | The narrative model call fails | The fallback text counts not-assessed skills too ("… and 2 not assessed"). | new |

### Backend: data model and API

| # | Given | Then | Test |
|---|---|---|---|
| AC-17 | The migration runs on a database with existing portfolios | No existing row changes. Old ratings stay as they are (see "Existing data"). | migration spec |
| AC-18 | The migration is rolled back | It succeeds if no NULL levels exist. If there are, it stops with a clear message instead of inventing levels. | migration spec |
| AC-19 | `GET /sessions/:id/portfolio` | Each skill includes `assessment_status` (`assessed` / `not_assessed`) and `not_assessed_reason`; `ai_level` is an integer or `null`. | request spec |
| AC-20 | An override on a not-assessed skill | Allowed, with `ai_level` NULL in the override row, but `assessor_notes` is **required**: a human rating with no AI evidence must say where it came from. | request spec |
| AC-21 | A failed portfolio is fetched | The response carries `generation_error_category` and a safe message, never the raw exception text. | request spec |

### Frontend: portfolio page and fit/gap page

| # | Given | Then | Test |
|---|---|---|---|
| AC-22 | A not-assessed skill | The card shows a neutral "Not assessed" badge (no level, no confidence), the reason in plain language ("Not reached before the interview ended", "Not enough evidence to rate", "Missing from the AI's output"), and an **Add rating** action instead of "Override". | component test |
| AC-23 | `ai_level` is `null`, a number, or an unexpected string | Never rendered as L1. `parseLevel` returns `null` for anything it can't read, and the UI treats `null` as not assessed. | unit test |
| AC-24 | Some skills aren't assessed | A summary line at the top: "2 of 3 skills weren't assessed. The interview ended after 6 minutes (ended by the candidate)." | component test |
| AC-25 | Fit/gap with not-assessed skills | Those rows read "Not assessed" with a hint to probe in the next interview. The summary counts them separately. The Required column shows the level. | component test |
| AC-26 | Fit/gap generation hasn't finished after 2 minutes, or polling errors | An error state with Retry, not an endless spinner. The page triggers generation at most once per visit. | component test |
| AC-27 | Portfolio load fails (network or 5xx) | An error state with Retry, not a blank page. | component test |
| AC-28 | Long evidence quotes and summaries | They wrap without breaking the layout, and anything over 4 lines is collapsed with "Show more". | component test + screenshot |
| AC-29 | At 375px wide | The fit/gap table becomes stacked rows, and the header actions wrap. No horizontal scroll. | screenshot |
| AC-30 | Keyboard and screen reader | "Not assessed" is announced as text, not conveyed only by color; Show more and Add rating are reachable with Tab. | manual check; automated in sub-PR 12 (axe, keyboard E2E) |

---

## Options compared

All three fix the same user problem. They differ in where the truth lives.

### Option A: hide it in the UI

The database keeps L1. The web treats `L1 + low confidence + coverage not_yet` as "not assessed" and hides the badge.

### Option B: make "not assessed" a real state, end to end *(recommended)*

`ai_level` becomes nullable, with an explicit `not_assessed_reason`. The generator decides assessed vs not assessed
from the model output **and** the coverage map, reconciles against the configured skills, verifies quotes, and
writes in one transaction that keeps overrides. Fit/gap and every API payload carry the state. The web renders it
as its own state.

### Option C: B plus a confidence-aware verdict and a historical backfill

As B, plus fit/gap verdicts that depend on confidence ("gap, low confidence → verify"), and a migration that rewrites
existing L1 rows to NULL where the coverage map shows the skill was never probed.

| | A: UI only | **B: real state** | C: B + verdicts + backfill |
|---|---|---|---|
| **Product impact** | Low. The assessor's screen looks right, but **fit/gap, the PDF and the JSON export still say L1/gap**. The lie moves to the artifacts that leave the building. | High. Every surface (screen, fit/gap, PDF, export) tells the same truth. | Highest on paper. But rewriting past ratings changes results people may already have acted on. |
| **Cost** | Small (web only) | Medium: 1 migration, generator, engine, 2 serializers, 2 screens, a web test runner | Large: B + verdict redesign + data migration + its review |
| **Maintainability** | Poor. "Not assessed" is inferred in one place and has to be re-inferred everywhere else, and the inference is fuzzy (a real L1 with low confidence looks the same). | Good. One explicit field, one place that decides it (the generator), every reader just displays it. | Good, but the verdict logic needs product sign-off on thresholds I'd be guessing. |
| **Reversibility** | Trivial | Good. The migration only relaxes constraints and adds a nullable column; rollback is safe while no NULLs exist, and stops clearly if they do. The API adds fields and keeps `required_level`. | Weak. A backfill that rewrites ratings can't be cleanly undone without a snapshot. |
| **Failure modes** | A real L1 gets hidden; exports keep fabricating. | A model that invents a level for an unprobed skill is caught by the coverage rule (AC-2). If the coverage map is itself wrong, a skill may be marked not assessed when it was discussed. That's the **safe** direction: the assessor sees it and can add a rating. | As B, plus a wrong threshold silently changes verdicts. |
| **Fit with the codebase** | Fights the data model | Uses what exists: coverage maps, `Portfolio.generation_status`, the harness's stubbed model, the pending specs. | Same as B, but needs decisions the spec doesn't make. |

**Decision: B.** It's the smallest change that makes every output honest. C's extras go to follow-ups. The verdict
thresholds need a product decision, and the backfill needs a decision about results people may already have
acted on.

---

## Design details (Option B)

### Data model

One reversible migration:

- `portfolio_skills.ai_level`: NULL allowed; the check becomes `ai_level IS NULL OR ai_level BETWEEN 1 AND 5`.
- `portfolio_skills.ai_confidence` and `competency_summary`: NULL allowed (AC-12).
- `portfolio_skills.not_assessed_reason`: new nullable string, validated to `not_reached`, `insufficient_evidence`
  or `omitted_by_model`. A check constraint keeps it consistent: the reason is set **iff** `ai_level` is NULL.
- `assessor_overrides.ai_level`: NULL allowed, with the matching check (AC-20).
- `portfolios.generation_error_category`: new nullable string (AC-10, AC-21).

No column is dropped or renamed, and no existing value changes. Rollback (AC-18) re-adds the `NOT NULL`
constraints only after checking that no NULLs exist, and raises with the count otherwise.

`assessment_status` in the API is **derived** (`ai_level.nil? ? 'not_assessed' : 'assessed'`), not stored, so it
can't drift from the level.

### Generator: who decides "assessed"

In this order, per configured skill:

1. **Coverage first.** Coverage `not_yet`, or no coverage row at all → not assessed, `not_reached`, whatever the
   model said (AC-2).
2. **Then the model's level.** Parsed strictly. Only an integer 1..5 (from `3`, `"3"`, `"L3"`, `3.0`) counts.
   Anything else → `insufficient_evidence` (AC-3, AC-4).
3. **Missing from the output** → `omitted_by_model` (AC-5).
4. **Evidence.** Keep only quotes found in candidate turns. No verified quote left → confidence `low` (AC-7).

The whole replace runs in a single transaction. Overrides are moved to the new rows by skill identity before the
old rows go (AC-8, AC-9). The model is called **before** the transaction opens, so a slow model call doesn't hold a
database transaction open.

### Frontend

- Fix the types first: `ai_level: number | null`, plus `assessment_status`, `not_assessed_reason`,
  `expected_level` and `is_override`. `parseLevel` returns `number | null`.
- `SkillPortfolioCard`: a distinct not-assessed variant (AC-22), with long text collapsed (AC-28).
- `PortfolioPage`: summary line (AC-24), error state (AC-27).
- `ComparisonTable`: read `expected_level`, render not-assessed rows and counts (AC-25), stacked rows on mobile
  (AC-29).
- `FitGapReportPage`: trigger once, then time out into an error state (AC-26).
- Use the existing components (`Card`, `Badge`, `Button`, `Tooltip`) and Tailwind tokens. No new visual language.

### Existing data

No backfill. Ratings already stored stay as they are, because people may have acted on them, and rewriting them is
a product decision (Option C). I'll add a **read-only** rake task that lists portfolio skills stored as L1 whose
coverage shows `not_yet`, so the team can see how many results are affected and decide.

---

## Test plan

- **API:** remove the `pending` markers as each defect is fixed; add the "new" specs above. Model responses come
  from `FakeGemini`; no live calls.
- **Web:** add Vitest + Testing Library (none exists today; brief baseline) with component tests for
  `SkillPortfolioCard`, `ComparisonTable` and `parseLevel`.
- **Watched to fail:** each new spec is run against the unfixed code first, and its failure message is checked to
  be the assertion, not a setup error (lesson from AI verification moment 5).
- **Seeded fault test:** on a scratch branch, put the clamp back (`.to_i.clamp(1, 5)`), show AC-1/AC-4 failing,
  then revert, with the history kept visible.
- **Manual:** screenshots of each state (assessed, not assessed, mixed, failed, generating, long text, 375px).

## Delivery

Brief Option B: an umbrella PR plus focused sub-PRs, each reviewable on its own.

1. **Tenant scoping** for portfolio export, override and fit/gap reads (P0-2). Removes 3 pending specs.
2. **Web: tolerate a missing level** (AC-23): `parseLevel` returns `null` instead of throwing, and the cards and
   override panel handle it. This has to land **before or with** sub-PR 3: today a `null` level crashes the whole
   portfolio page (Step 3, P2-11), so the API change alone would take the review screen down.
3. **Data model + generator** (AC-1..AC-12, AC-17..AC-21).
4. **Fit/gap engine + payload** (AC-13..AC-16).
5. **Portfolio and fit/gap screens** (AC-22, AC-24..AC-30). The web test runner already exists (branch
   `test/functional-tests`); these change the matching `it.fails` tests to `it`.

## Follow-ups (not in this change)

- Candidate notice and recorded consent before the mic opens, in the interview language (P2-4). Next in line,
  together with two candidate-side fixes found by the functional tests: a broken invite link must not say the
  interview "has been recorded" (P1-11), and the hardware check must measure against our own API, not third
  parties (P1-12).
- Confidence-aware fit/gap verdicts and a decision on past ratings (Option C).
- ~~Duplicate fit/gap jobs on the server side (P1-6).~~ Done in sub-PR 7: the report row is claimed before the job
  is queued.
- Gemini HTTP retries for POST (P2-3), and a deploy check that production uses the paid tier.
- ~~Parameter filtering for passwords and notes in logs (P1-7).~~ Done in sub-PR 6, together with candidate names
  and invite tokens.
- Users linked to a company (C2). Sub-PR 8 checked every route for cross-tenant access and found no leak, but login
  takes the company from the `X-Tenant-Scheme` header, so any admin can sign in to any company. Pinned as pending;
  the fix needs a data-model decision in the database shared with `rakamin-api`.

## Risks and assumptions

- **Assumption:** the coverage map is reliable enough to overrule the model on `not_yet`. If the analyzer lags
  (PRD 02 notes a one-turn lag), a skill discussed in the very last turn could be marked not reached. That's the
  safe direction, and the assessor can add a rating. Worth confirming with the Tech Lead.
- **Risk:** `end_reason` can't be trusted on its own: anyone with the invite link can end a session as
  `all_covered` (Step 3, P1-10). The design doesn't depend on it: "assessed" is decided by the coverage map and the
  model output. The one place that shows it, the summary line in AC-24, should name the reason only when it agrees
  with coverage, and otherwise say "the interview ended before these skills were reached".
- **Assumption:** keeping `required_level` alongside `expected_level` for one release is acceptable; nothing else
  consumes the fit/gap payload today besides this web app and the PDF.
- **Risk:** quote matching may drop real quotes the model paraphrased slightly. The match is normalized but still
  exact, by design: a quote shown as "from the interview" should be verbatim. A dropped quote lowers confidence;
  it doesn't erase the rating.
