# Trustworthy skill ratings: case study report

Branch: `feat/trustworthy-skill-ratings` · Seeded-fault proof: [`scratch/seeded-fault`](https://github.com/fahmiprasanda123/ai-interview-platform/commits/scratch/seeded-fault)
Acceptance criteria: [`acceptance-criteria.md`](acceptance-criteria.md) · Evidence: [`evidence/`](evidence) · Screenshots: [`screenshots/`](screenshots)

Pull request: https://github.com/rakamindev/ai-interview-platform/pull/155 ·
Video: https://drive.google.com/file/d/1QADhrV3B2xdXttWiO0PhWcjl6oE8p_WN/view?usp=sharing

---

## 1. Summary

The product exists to give an assessor a rating they can defend, and to give
the candidate a fair one. Before this change, the system turned *missing evidence*
into *a low score*:

- A skill the interview never reached was saved as **L1** (the model's `null`
  level went through `nil.to_i.clamp(1, 5)`), then shown as a **gap** against
  the vacancy. The candidate was marked down on a question nobody asked.
- Nothing checked that the "evidence" quotes were things the candidate said.
- The fit/gap table's **Required** column was always blank, because the frontend
  read a field the API never sends.
- Any assessor could read, export or **override** another organization's
  candidate ratings by changing an id in the URL.
- **PDF export crashed** for every portfolio that had an assessor override.

The change makes every rating either backed by verified quotes, or explicitly
**not assessed** and excluded from the gap count. Assessors see why, can link
each quote to the transcript turn, and must give a reason when they change a
rating. The fixes cover both services and are tested in both (72 RSpec examples,
25 Vitest tests, CI on every PR).

---

## 2. Context and domain (Step 2)

**The product, used end to end.** Assessor configures skills with L1–L5 anchors →
candidate does a live audio interview with Gemini → a coverage map tracks which
skills were probed → after the session, Gemini Pro writes a portfolio (level,
confidence, quotes, summary per skill) → the assessor reviews, optionally
overrides, compares against a vacancy (fit/gap), and exports a PDF.

I walked the post-interview half with seeded data (the live audio half needs a
Gemini Live key and a microphone; see Assumptions). That half is where hiring
decisions are made, so it is where a wrong number does the most damage.

**The industry.** Hiring in Indonesia is high volume: one entry-level opening
can draw hundreds of applicants, and assessors are often HR generalists
rather than specialists in the skill being assessed. Running an interview is
increasingly commoditized (AI interviewers, video screening). The value is in
a **defensible signal**, one an assessor can trust enough to act on and explain
to a hiring manager. A tool that produces confident-looking numbers it can't
back up is worse than no tool: it moves bad decisions faster.

**The users.** Assessors and recruiters skim results between many candidates.
They read the level badge and the fit/gap table, and rarely the transcript. So
the badge and the table have to be right by themselves. Hiring managers see the
PDF, often forwarded without the app around it.

**The people who never chose it.** Candidates can't opt out and can't see how
they were scored. Under **UU PDP (Law No. 27 of 2022)** they are data subjects
with rights over automated processing that has significant effects on them,
including the right to object to decisions based solely on automated
processing. Practically, that means:

- a rating must be **explainable**: which words, from which turn, led to it
- missing evidence must not be dressed up as a judgement
- when a human changes a rating, the reason must be recorded
- error messages and logs must not leak transcript content

---

## 3. Problem and gap to ideal (Step 3)

**Ideal:** every level shown to an assessor is backed by something the candidate
actually said; everything else is clearly labelled as unknown; the comparison
with the role counts only what is known; and the numbers are the same in the
app, the JSON and the PDF.

### Findings

**M** = missing specification (never defined). **D** = defective implementation
(defined, but broken).

| Sev | Type | Finding | Impact on the real workflow |
|---|---|---|---|
| **P0** | D | Skills never reached in the interview are saved as L1 (`nil.to_i.clamp(1,5)`), and the model is asked to rate them anyway | The candidate gets a "gap" on a skill nobody asked about; the assessor sees a confident L1 |
| **P0** | D | `Portfolio.find` / `PortfolioSkill.find` are not tenant-scoped | An assessor at company A can export or **override** company B's candidate ratings by id (proved: 201 on a cross-tenant override, 200 on cross-tenant export) |
| **P1** | D | `audio_websocket_middleware.rb` defines `AudioWebSocketMiddleware`, so Zeitwerk eager loading raises `NameError` (`rails zeitwerk:check` fails on `main`) | Production uses `eager_load = true`, so the API can't boot there; found when CI ran tests with eager loading |
| **P1** | M | Evidence quotes are never checked against the transcript | Hallucinated quotes look exactly like real ones and justify a level |
| **P1** | D | Confidence is taken from the model, although PRD 01 defines it from probe count and coverage | A skill probed once can show "high confidence" |
| **P1** | D | Fit/gap table reads `required_level`, API sends `expected_level` | The "Required" column is always blank, so the gap can't be checked at a glance |
| **P1** | D | Regenerating a portfolio runs `destroy_all` on skills, which cascades to assessor overrides | A human judgement is silently deleted |
| **P1** | D | PDF export uses a `→` character that Prawn's built-in font can't encode | Export fails for every portfolio with an override, which is exactly the one most likely to be forwarded |
| **P1** | D | Fit/gap page re-POSTs "generate" on every 404 poll, every 5 s, with no timeout | A new job every 5 s while the page is open; spinner forever if the job dies |
| **P2** | M | No reason required for an override | No record of why a candidate's rating changed |
| **P2** | D | Cached fit/gap report is returned even after the vacancy changes ("no new overrides" comment, but no check) | Decisions made on outdated comparisons |
| **P2** | D | Generator saves skills without a transaction; no guard against duplicate jobs | Partial portfolios; duplicate model calls |
| **P2** | D | `generation_error` stores raw exception text | Can echo model output, i.e. transcript content (UU PDP) |
| **P2** | D | `GET /portfolio` returns an empty portfolio while still `pending` | UI briefly shows "no skills" |
| **P2** | D | `Portfolio` has no `fit_gap_reports` association, so deleting it hits the foreign key | A portfolio or session with a fit/gap report can't be deleted (e.g. for a UU PDP deletion request) |
| **P3** | D | `LevelRadio` uses fixed ids, so labels on multi-skill pages control the first group | Clicking L4 on skill 3 changes skill 1 (also on vacancy and assessment forms) |
| **P3** | D | Assessor pages scroll sideways at 375 px (header ~550 px wide) | Unusable on phones |
| **P3** | D | Emoji result badges, "You Overridden ✓" copy | Reads as unfinished |

### Constraint signals (would escalate to the Tech Lead)

1. **Login lets the client pick the tenant.** `AuthenticationController#resolve_scheme`
   puts the `X-Tenant-Scheme` request header into the JWT. Users are global (no
   tenant link), so any admin can mint a token for any organization. This is a
   bigger P0 than the IDOR above, and the fix needs a product decision (how users
   map to tenants), so I didn't change it in this PR.
2. **JWT claims are trusted without a DB lookup**, including `role`. Revoking a
   user takes up to the token lifetime (3 days).
3. **Transcripts are sent to Google (Gemini).** Under UU PDP that is a
   cross-border transfer that needs a legal basis and a notice to the candidate.
   I found no candidate-facing notice and no retention policy for transcripts
   or audio.
4. **Candidates can't see or contest their result.** There is no data-subject
   access path. That's out of scope here, but the verified evidence and override
   reasons added in this PR are the data such a feature would need.
5. **No idempotency for the live session pipeline** (coverage analyzer). I didn't
   touch it; it deserves the same treatment as N10.

---

## 4. Strategy, acceptance criteria and trade-offs (Step 4)

The full input/edge-case table is in [`acceptance-criteria.md`](acceptance-criteria.md)
(G1–G15 generator, O1–O5 override, F1–F9 fit/gap, U1–U10 UI). The key rules:

- No level without at least one quote that appears verbatim in a candidate turn
- A skill coverage never reached is `not_assessed`, and the model isn't asked about it
- Confidence comes from coverage (PRD 01 §5), never from the model
- `not_assessed` is never a gap: not in counts, not in the narrative prompt
- Every failure path (timeout, non-JSON, half-written save, duplicate job,
  dead worker) ends in a known state with a message that holds no transcript text

### Options considered

| | **A. Post-validate in the generator (chosen)** | **B. Constrain the model (structured output + stricter prompt)** | **C. Human-gated: no AI levels until an assessor confirms** |
|---|---|---|---|
| What it buys | Every stored level is checked against the transcript and coverage, whatever the model does | Fewer bad answers at the source | Maximum safety; every number is human |
| Cost | ~1 day; one migration (nullable level + status) | Depends on Gemini schema support for the configured model; still needs validation, since schemas don't stop invented quotes | Changes the product: assessor workload goes up per candidate, which is the cost the product exists to remove |
| Maintainability | Plain Ruby, unit-testable without the model; rules live in one class | Prompt and schema drift with model versions | Simple code, heavy process |
| Failure modes | Over-strict matching could drop a real quote that the model lightly paraphrased → skill shows "insufficient evidence" (safe direction: unknown, not wrong) | Model ignores the schema or invents quotes inside it | Assessors rubber-stamp under volume |
| Walk-back | Feature is additive; rollback migration refuses only if unrated rows exist | Easy | Hard; changes workflows |

**Why A:** it is the only option that *guarantees* the property we need (no
unbacked level reaches an assessor) without depending on model behaviour, and it
fits the existing code (one service, one migration). B is complementary and
cheap to add later (the prompt already asks for verbatim quotes and `null`
levels). C is the right call only if A's "insufficient evidence" rate turns
out to be high in production. It is worth measuring.

**Trade-off I accepted:** matching is word-for-word after normalising case,
punctuation and whitespace. The model may lightly rephrase a real quote, and
then it gets dropped. I chose false "unknown" over false "known". Fragments joined
with `…` are allowed if they come from the same turn.

---

## 5. Implementation and proof (Step 5)

### What changed

**API**
- `Portfolios::Generator`: decides rated / not_assessed / insufficient_evidence,
  verifies quotes (`Portfolios::EvidenceMatcher`, keeps the turn number),
  derives confidence from coverage, saves in one transaction, updates rows in
  place (overrides survive), atomically claims the portfolio (duplicate jobs exit,
  a dead worker can be taken over after 10 min), stores only safe error text
- Migration: `portfolio_skills.ai_level` nullable + `rating_status` (check
  constraints keep level and status consistent) + `probe_count`, `coverage_state`;
  `portfolios.generation_started_at`; `fit_gap_reports.input_fingerprint`.
  Safe on existing rows (all have a level → `rated`); the rollback refuses if
  unrated rows exist instead of inventing a level
- `FitGap::Engine`: not_assessed handling, override + AI level + low-confidence
  flags, fingerprint for staleness, race-safe upsert, narrative prompt told
  "not assessed is not a weakness", proper fallback
- Tenant scoping for portfolio and override endpoints; overrides need a reason
  and are refused on unrated skills; `enqueue_once` lock for fit/gap jobs
- PDF: Windows-1252-safe text, unrated skills and override reasons printed
- Zeitwerk inflections for the two websocket middlewares, so eager loading
  (production, CI) boots
- `Gemini::HttpClient`: optional Interactions API (`GEMINI_HTTP_API=interactions`).
  New AI Studio keys are auth keys (`AQ.`) that pass Gemini Live but get 404 on
  every `generateContent` call, so portfolios could not be generated at all with a
  fresh key. Error bodies (which can echo the transcript) are no longer logged

**Web**
- Portfolio page: honest unrated state (no badge, reason, "not counted", no
  override), confidence explained in probes, quotes link to `#turn-N` on the
  transcript (scrolls and highlights), override with required reason and inline
  server errors, generating state with elapsed time, failed state with reason
  and visible retry errors, long-summary collapse
- Fit/gap page: required level shown, not-assessed neutral and excluded from
  gap counts, low-confidence and override labels, stale banner + regenerate,
  `useFitGapReport` (trigger once, poll GET, 2-minute timeout), stacked cards
  on phones, icons instead of emoji
- `LevelRadio` unique ids; header fits 375 px

### Test harness (there was none)
- **RSpec**: `rails_helper`, tenant helpers, factories with fictional data, a
  `FakeGeminiClient`; 72 examples across generator, matcher, engine, PDF and
  request specs (tenant isolation, override rules, job dedupe, staleness)
- **Vitest + Testing Library**: 25 tests for `parseLevel`, `ComparisonTable`,
  `SkillPortfolioCard`/override flow, `useFitGapReport` (fake timers)
- **CI** (`.github/workflows/ci.yml`): builds the DB from migrations, rolls the
  new ones back and re-applies them, fails on `schema.rb` drift, runs RSpec;
  web runs typecheck, tests and build. RSpec runs with `CI=true`,
  so the whole app is eager-loaded. The workflow holds no credentials: the
  throwaway Postgres container uses `trust` auth, and the test-only secrets come
  from `rails_helper`. The first version set `POSTGRES_PASSWORD: postgres`, which
  the repo's GitGuardian check flagged, so that commit was rewritten.

### Proven correctness: watched it fail
1. **Against the original code** (`evidence/baseline-rspec-against-main.txt`):
   the same specs on `main` fail 48/57. The key ones:
   - `treats nil as no level`: got `ai_level: 1, rating_status: "rated"`
   - cross-tenant override: expected 404, **got 201**
   - cross-tenant export: expected 404, **got 200**
   - `evidence/baseline-pdf-override-crash.txt`: `Prawn::Errors::IncompatibleStringEncoding`
2. **Seeded fault** ([`scratch/seeded-fault`](https://github.com/fahmiprasanda123/ai-interview-platform/commits/scratch/seeded-fault), history visible):
   commit `test: seeded fault - unknown levels fall back to L1 again` puts the
   clamp back in the generator and the L1 fallback in `parseLevel`. RSpec:
   6 failures; Vitest: 5 failures (`evidence/seeded-fault-*.txt`). The next
   commit reverts it and both suites are green again.

### AI verification moments
I used an AI coding assistant (Claude Code) for much of the implementation. These
are the places where its output was wrong or risky, and how they were caught:

1. **Wrong edge-case behaviour, caught by the spec.** The first generator draft
   still sent skills to the rating path when the candidate had never spoken. They
   came out as `insufficient_evidence` instead of `not_assessed`, which says "we
   heard them and it wasn't good enough" about someone whose mic may have failed.
   The G8 spec failed on the first run (1 of 65); the fix gates "assessable" on the
   candidate having spoken.
2. **Duplicate check that couldn't work.** Discovered skills were de-duplicated
   against configured ones by `identity_key`, which is `id:<skill_id>` for
   taxonomy skills and `label:<name>` for discovered ones, so they could never be
   equal. A model-"discovered" `react` would have shown up next to the configured
   React skill with its own level. Caught while writing the G15 spec; now compared
   by normalised label.
3. **Matcher too loose.** The first evidence matcher used plain substring search
   after normalisation, so "art" matched inside "start". Fixed by matching whole
   words (padding with spaces) and covered by a spec.
4. **Misleading UI copy, caught in the browser.** The fit/gap fallback said
   "Written by AI" when the AI call had failed and the text was counted from the
   table, and it told the assessor to "regenerate" on a page with no regenerate
   button. Both fixed after clicking through the real flow.
5. **A CI run that only passed on my machine.** My first local CI simulation
   passed because it picked up my `config/application.yml`. Re-running it in a
   clean worktree with only the CI environment showed two real failures:
   `ALLOWED_ORIGINS` is required at boot, and eager loading crashed on the
   websocket middleware names (a bug already on `main`). Both are fixed.
6. **Test tooling surprise.** A Vitest test for the override error failed even
   though the UI showed the right message. Logging showed the component did catch
   the error. The failure came from `vi.fn()` in Vitest 3.2 reporting the rejected
   promise. Plain stubs are used for those cases, with a comment explaining why.
   The UI was not changed to make the test pass.

### Screenshots
`screenshots/01`–`13`: rated skills, low confidence and not assessed, discovered
skills, override requiring a reason, saved override, fit/gap (desktop, stale,
generating, fallback), phone layouts at 375 px, failed and load-error states.

---

## Assumptions

- Ran the post-interview flow with `db/seeds/demo_interview.rb` (fictional data,
  real generator and engine, canned model answers), then regenerated the same
  portfolio against real Gemini (`gemini-3.8-flash` via Interactions, 19 s): same
  ratings, the override survived, the unreached skill stayed not assessed. A
  Gemini Live WebSocket setup with the same key succeeded. *Run one full spoken
  interview before recording the video.*
- Pro-tier models have zero free quota on the test key, so both the "Pro" and
  "Flash" roles used `gemini-3.8-flash` locally.
- "Discovered" skills without verifiable evidence are dropped rather than shown
  as insufficient evidence: nobody configured them, so they'd only add noise.
- Override on an unrated skill is refused. The assessor's real action there is a
  follow-up interview, and an override with `ai_level` empty would break the audit
  trail of "AI said X, human said Y".
- Login tenant selection (constraint signal 1) is left as is pending a product decision.

## How to run the demo
```
cd api && bundle exec rails db:create db:migrate db:seed
bundle exec rails runner db/seeds/demo_interview.rb   # prints the URLs
bundle exec rspec
cd ../web && npm ci && npm test && npm run dev
```
