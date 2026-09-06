## The change in one line

The fit/gap report is where this product throws away its own evidence. This
restores it, closes a proven cross-tenant data leak found on the way, and adds
the test harness and CI the repository had none of.

---

## Why this, and not something else

This system works hard to know what it does not know. Skills are defined with
behavioural anchors, the coverage analyser tracks `probe_count` and a
`not_yet → initiated → partial → covered` state per skill, and the portfolio
generator assigns an explicit `ai_confidence` alongside verbatim evidence quotes.

All of that survives into the API payload of the final screen — and dies there.
The fit/gap comparison table reduced every skill to a level and one of four
badges. Captured from the running instance:

| Skill | Rendered | Actually backed by |
|---|---|---|
| React / Frontend Development Core | `✅ Match` | `high` confidence, 3 quotes |
| Micro-frontend Architecture | `✅ Match` | **`low` confidence, 1 quote**, coverage state still `partial` |

Two identical badges. One is a measurement; the other is a guess about a skill
the interview stumbled onto. The recruiter deciding a candidate's year could not
tell them apart.

And the column that makes the screen a *comparison* at all was blank.

---

## The defect at the seam

`FitGap::Engine` serialises `expected_level`
([engine.rb:62](../blob/main/api/app/services/fit_gap/engine.rb)). The frontend
declared `required_level: number` as a **required** field and read
`LEVEL_LABELS[c.required_level]`. The key has never existed, so the lookup
resolved `undefined` and React rendered nothing — the "Required" column was
empty for every row.

Three things make this worth reading closely:

1. **The compiler reported success.** Responses are cast at the axios boundary
   rather than validated, so the declared contract described a shape the server
   never sends. This is the root cause, not an incidental detail — see
   *Constraint signals* below.
2. **`Exports::PdfGenerator` reads `expected_level` correctly.** One payload, two
   renderers, one broken. The PDF showed the required level; the web UI did not.
3. **A real assessor override was invisible.** The UI legend promises
   *"✏ = human override applied"*, but the payload never sent `is_override`, so
   the marker was unreachable code. In the captured session an assessor had
   overridden Communication from the model's L2 to L3 with a written
   justification; the engine used that correction, and the table showed no trace
   of it. A tool that hides the reviewer's own correction trains the reviewer to
   stop correcting.

The field is renamed to follow the domain rather than the reverse:
`expected_level` is the column name in `vacancy_skills`, the key the PDF
generator already reads, and the name the engine emits. `required_level` existed
only in that one interface. The column *label* stays "Required".

---

## A P0 found and proven while writing the specs

`TenantScoped` gives Assessment, Session and Vacancy a `default_scope` on
`Current.tenant_id`. Portfolio, PortfolioSkill, AssessorOverride, TranscriptTurn,
CoverageMap and FitGapReport have no `tenant_id` column and include none of it,
so their isolation depends on every controller reaching them through a scoped
parent. Two did not.

A request spec drives the real middleware stack with a valid, correctly signed
`admin` token belonging to a **different** organisation than the records it
touches. Against the original code:

```
POST /api/v1/portfolio_skills/6/override        -> HTTP 201 Created
     AssessorOverride persisted: override_level 5, overridden_by 99,
     on a portfolio skill owned by another organisation

GET  /api/v1/portfolios/1/export?format=json    -> HTTP 200
     body contained the candidate's name and their verbatim interview quotes
```

Four of seven examples failed. `Portfolio.find(params[:id])` appeared in four
places, and `PortfolioSkill.joins(:portfolio).find(params[:id])` — where the
join constrained nothing at all and only made the query a join.

One example passed from the first run: the same portfolio reached through
`GET /api/v1/sessions/:id/portfolio` was already refused, because `Session` is
tenant-scoped. **The mechanism works where it is applied.** That is what makes
this a missing application of an existing pattern rather than a missing pattern.

Ownership here is transitive — portfolio → session → tenant — so an `in_tenant`
scope expresses exactly that and the controllers use it. A foreign id now raises
`RecordNotFound` and returns 404, which also declines to confirm the id exists.

**This was first reported at P1 and deliberately escalated to P0 only after the
spec existed.** A claim is worth what its evidence is worth. It is also a change
of mind worth stating plainly: the original plan was to escalate this rather than
patch it, on the grounds that the remedy is architectural. Proving it was cheap,
and once proven, shipping a demonstrated P0 unfixed is a weaker position than
closing the endpoints and escalating the class of bug — which CS-1 still does.

---

## What is in the change

### `api/`

- Each comparison now carries `is_override`, `ai_level` and `evidence_count`
  alongside the existing `confidence`, so presentation can distinguish a
  measurement from a guess and show a human correction.
- `narrative_degraded` records that a narrative came from the rule-based fallback
  rather than the model. A failed model call was previously silent.
- **A vacancy with no skills no longer kills the job.** `Vacancy` only requires
  `role_title`, so a skill-less vacancy is legal — but `FitGapReport` validated
  `skill_comparisons` with `presence: true`, and Rails treats `[]` as blank.
  `update!` raised `RecordInvalid`, the worker exhausted its retries, and the UI
  polled a report that would never arrive, with no error anywhere. The validation
  now requires a list and permits an empty one.
- The fallback summary said *"1 gaps"*. Counts now select their wording.

### `web/`

- The comparison table renders the required level, the model's confidence, the
  number of supporting quotes, the assessor's correction with the superseded
  level struck through, and `Never probed` for a requirement that was never
  assessed.
- The summary counts unassessed requirements — the easiest line to scroll past
  and the most consequential to miss — and flags how many rows rest on low
  confidence.
- `medium` confidence was being displayed as the word **"confirmed"**
  (`x === "low" ? "low confidence" : "confirmed"`). The system's own word for
  middling evidence was rewritten on screen as the word for verified.
- **The page contradicted itself.** The additive-skills panel selected on
  `is_discovered` and hardcoded *"Not required for this role"* without consulting
  the vacancy — while the table above listed the same skill as a matched
  requirement. Both statements were on screen at once. The vacancy is now the
  authority.
- Narratives appear only under their own headings, and a degraded report says so
  explicitly instead of presenting a mechanical count as a culture assessment.
- Evidence quotes rendered as `""I put together a one-pager…""` because the
  generator already wraps them (PRD-01 §5) and the card wrapped them again.
- Two further contract inversions corrected: `PortfolioSkill.skill_id` was typed
  `number` but is a varchar (`"SK-ENG-001"`), and `ai_level` was typed `string`
  with a comment claiming `"L1".."L5"` while the API sends an integer — which is
  why an additive skill rendered as a bare `2` where `L2` belonged.
- Rows reflow into labelled cards below `sm` using the same `data-label`
  attributes the desktop table uses, so there is one DOM rather than a duplicated
  mobile tree. The portfolio card header previously could not reflow at all: on a
  phone the skill label wrapped to one or two words per line and the override
  control was pushed off-screen.

### repo

Following the setup documentation verbatim produced an application that rendered
perfectly and failed every request — the most expensive kind of onboarding bug,
because nothing announces itself as broken. I lost time to it before recognising
it as a finding rather than my own mistake, and it is plausibly why the P0 above
survived to `main`: the screen that decides a hire had no reproducible path to
being looked at.

- `web/.env.example` shipped `localhost:3000` for both the REST and WebSocket
  URLs; the API serves on **3001**. The README instructs you to copy that file.
- `web/README.md` stated the backend default as port 3000.
- `api/README.md` step 7 said `cd ../ai-interview-web` — a directory that does
  not exist. The frontend is `web/` in this same repository.
- `db:seed` created an organisation and 22 taxonomy skills but **zero users**,
  while login requires a persisted `admin`. A fresh clone could not be signed
  into at all; the documented workaround was to mint a JWT by hand into
  `VITE_DEV_TOKEN`, which bypasses the login screen rather than exercising it.
  The seed now creates an assessor account — skipped in production, overridable
  via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, idempotent.

Verified end to end: the seeded credentials return a token from
`POST /auth/login`, that token returns 200 from `GET /assessments`, and a wrong
password returns 401.

---

## Migration safety

One migration, `add_narrative_degraded_to_fit_gap_reports`.

- **Reversible** — `add_column` inside `change` reverses to `remove_column`.
- **Safe against existing rows** — `default: false` backfills, so `null: false`
  holds immediately. `false` is the honest value for reports generated before
  this distinction was tracked; it preserves today's rendering rather than
  retroactively labelling historical reports as degraded.
- **No table rewrite** — PostgreSQL 11+ stores a non-volatile column default as
  catalog metadata, so this is O(1) and takes no long-lived exclusive lock.

Verified locally with `db:rollback STEP=1` followed by `db:migrate`. **CI now
asserts the same on every pull request**, so a future irreversible migration
fails review rather than production.

---

## Test harness — built from zero

The repository had RSpec in the Gemfile with a `.rspec` file and **no `spec/`
directory**, no test runner in `web/package.json`, and no CI.

| | Before | After |
|---|---|---|
| `api/` | 0 specs (no `spec_helper`) | **27 examples** (20 service + 7 request) |
| `web/` | no runner | **25 tests** |
| CI | none | both suites + typecheck + reversibility check |

Two details worth review:

- `rails_helper` clears `RequestStore` after every example. `TenantScoped`
  applies a `default_scope` keyed on `Current.tenant_id`, which the middleware
  normally sets per request; without the reset, tenant state leaks between
  examples and specs pass or fail depending on ordering.
- The frontend fixtures are transcribed from a **real** N13 response, not written
  to match the component. A fixture shaped to the component's expectations would
  have hidden the very defect it was meant to pin down.

Coverage includes the full comparison matrix, override precedence, id-before-label
matching, unassessed requirements, model-call failure, duplicate generation
(idempotence), a vacancy with no skills, a 4 000-character summary, and long skill
labels.

### Seeded fault test

Branch: **`scratch/seeded-fault`** · captured output:
`assessment/evidence/seeded-fault-test.txt`

Three minimal, plausible regressions — the kind a careless refactor produces, not
syntax errors — were introduced, then reverted with the history left visible:

| Fault | Caught by |
|---|---|
| Drop `is_override` from the payload | 2 RSpec examples |
| Read `required_level` again | 3 Vitest examples |
| Strip one quote layer *per pair type* | 1 Vitest example |

**Honest note.** The third fault was **not** caught on the first attempt. Every
existing example nested a single quote pair, and the stripping loop advances to a
*different* pair rather than retrying the same one, so the guard was never
exercised. The exercise found a hole in the suite instead of demonstrating its
strength — the more useful outcome. The missing example was added
(`test(web): cover mixed quote nesting`) before the evidence was recorded.

---

## What I deliberately did not do

| Rejected | Reason |
|---|---|
| Fix the AI interviewer's probing behaviour (PRD-01) | Not verifiable without paid live sessions; the result is subjective and cannot be pinned by a test |
| Enforce tenant isolation at the data layer | The endpoints I found are closed and covered by specs, but a `tenant_id` column on six tables, PostgreSQL RLS, or a mandatory scope in a base class is a design decision for the Technical Lead — see CS-1. The next bare `.find` reopens the same hole |
| "Fix" `advance_stale_partials` | It silently redefines what "covered" means, which drives `confidence: high` and lets interviews end early. That is a product decision, not an engineering patch — see CS-2 |
| Add runtime response validation (zod) across the API layer | The correct fix for the root cause, and too large to land safely tonight. Recommended as the follow-up, scoped in CS-4 |
| Redesign the application | The brief asks for the change that makes the product genuinely better, not the one that touches the most lines |

---

## Constraint signals

Escalated rather than resolved unilaterally. Full text in
`assessment/03-problem-and-gap.md` §6.

1. **Tenant isolation is enforced by controller discipline, not by the data
   layer.** `TenantScoped` covers only `Assessment`, `Session` and `Vacancy`.
   Portfolios, portfolio skills, overrides, transcripts, coverage maps and
   fit/gap reports have no `tenant_id` and are reached by primary key — e.g.
   `PortfolioSkill.joins(:portfolio).find(params[:id])`. Needs a design decision:
   `tenant_id` everywhere, PostgreSQL RLS, or a mandatory scope in a base class.
2. **`advance_stale_partials` converts a technical limitation into a claim about
   a candidate.** It promotes `partial → covered` at `probe_count >= 4` because
   the skill fell outside the analyser's 6-turn window — no model confirms the
   evidence is sufficient — and that state then becomes `confidence: high` and
   permits an early end.
3. **The frontend trusts the API contract with no runtime validation.** The root
   cause of the P0 in this PR. Renaming a key without addressing this leaves the
   next contract drift equally silent.
4. **The published specification is an extract.** The node numbering implies
   N1–N14, but **N3 and N12 are defined nowhere**, and the coverage-injection
   step is `B6` in PRD-01 and `N8` in PRD-02's trace.
5. **Setup documentation is stale and a fresh install cannot be logged into.**
   `db:seed` creates an organisation and 22 taxonomy skills but zero users, while
   login requires a persisted `admin`. `web/README.md` and `web/.env.example`
   both point at port 3000; the API serves on 3001. `api/README.md` step 7 says
   `cd ../ai-interview-web`, which does not exist. Following the README yields a
   UI that renders perfectly and silently fails every request.

---

## Verifying locally

```bash
# api
cd api && bundle install
bundle exec rails db:create db:migrate db:seed
RAILS_ENV=test bundle exec rails db:create db:migrate
bundle exec rspec                       # 20 examples, 0 failures

# migration reversibility
bundle exec rails db:rollback STEP=1 && bundle exec rails db:migrate

# web
cd ../web && npm ci
npx tsc --noEmit
npm test                                # 25 tests, 0 failures
```

Note that the assessor review screens cannot be reached from a fresh `db:seed` —
see constraint signal 5. That is why this defect survived to `main`: the screen
that decides a hire had no reproducible path to being looked at.
