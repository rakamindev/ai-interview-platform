# Step 3 — Problem & Gap to Ideal Condition

All findings below were reproduced on a local instance running the code at
`main` (`b836d02`), against a real fit/gap report generated through the product's
own UI and API. Every claim cites either a file:line, an observed API payload, or
a screenshot in `assessment/screenshots/`.

---

## 1. The core problem

> **This system measures how much evidence stands behind each judgement, and then
> discards that measurement at the exact moment a human uses it to decide.**

The product exists to make a hiring judgement *defensible*, not merely fast. Its
whole design reflects that intent: skills are defined with behavioural anchors
(L1–L5), the coverage analyser tracks `probe_count` and a `not_yet → initiated →
partial → covered` state per skill, and the portfolio generator assigns an
explicit `ai_confidence` of `high`/`medium`/`low` alongside verbatim evidence
quotes. The system works hard to know what it does not know.

That knowledge survives all the way into the API payload of the final screen —
and then dies there. The fit/gap comparison table, the last artifact a human
reads before deciding, reduces every skill to a level and one of four badges. A
`gap` inferred from a single unverified quote renders identically to a `gap`
backed by five probes and three quotes. The recruiter is shown **false
precision**: uncertainty replaced by a confident-looking verdict.

### Where the value chain breaks

```
anchors L1-L5  →  probe_count + coverage state  →  ai_confidence + evidence
                                                            │
                                          still present in the API payload
                                                            │
                                                            ▼
                                          ┌─────────────────────────────┐
                                          │  fit/gap comparison table   │  ← dropped here
                                          └─────────────────────────────┘
                                                            │
                                                            ▼
                                                    hiring decision
```

### Who is harmed

**Assessors, recruiters, hiring managers** — the users. They cannot calibrate
their trust, because the screen offers nothing to calibrate against. Worse, the
one signal they *do* contribute — a manual override, the product's only
human-in-the-loop control — is invisible on the comparison screen (P0-2). A tool
that hides the reviewer's own correction trains the reviewer to stop correcting.

**Candidates** — the people who never chose this product, cannot opt out, and
whose year changes on the result. They absorb every error above. A candidate
rejected on a `gap` derived from one quote has been rejected by a guess wearing
the costume of a measurement.

**UU PDP relevance.** Indonesia's Personal Data Protection Law (UU 27/2022) makes
this concrete rather than rhetorical: it requires accuracy of personal data,
transparency of processing, a right to correct, and gives the subject standing
where a decision is based on automated processing. Voice, transcript, and a
character judgement are all personal data. Two consequences follow directly.
First, a rating whose evidentiary basis is hidden from the human reviewer is
difficult to defend as an *accurate* processing outcome. Second, when the human
override — the mechanism that turns automated processing into a reviewed decision
— is not shown on the deciding screen, the review becomes decorative and the
decision drifts back toward being purely automated.

---

## 2. Severity rubric (self-defined)

The brief states that criteria are derived by the candidate. This rubric is
anchored on **harm to the decision**, not on implementation difficulty.

| | Definition | Release test |
|---|---|---|
| **P0** | Causes a wrong or unauditable hiring decision, leaks personal data across tenants, or loses data | Ship blocker. No. |
| **P1** | Materially misleads or blocks the decision-maker; workaround is expensive or non-obvious | Ship only with a documented mitigation |
| **P2** | Degrades trust or usability; a reasonable workaround exists | Ship, fix next |
| **P3** | Polish, documentation, developer experience | Ship |

---

## 3. Findings index

| ID | Finding | Sev | Category | Service |
|---|---|---|---|---|
| **F1** | Fit/gap "Required" column renders blank — API sends `expected_level`, UI reads `required_level` | **P0** | Defect | **seam** (api+web) |
| **F2** | Human override applied but never shown; legend promises a marker that cannot appear | **P0** | Defect | **seam** (api+web) |
| **F3** | Confidence reaches the payload and is dropped by the comparison table | **P1** | Missing spec + defect | **seam** (api+web) |
| **F4** | `medium` confidence is rendered as the word **"confirmed"** | **P1** | Defect | web |
| **F5** | The same page calls one skill both "matched requirement" and "not required for this role" | **P1** | Defect | web |
| **F6** | Portfolio records are reachable and writable without a tenant check | **P0** | Defect | api |
| **F7** | LLM narrative failure is silent, and the fallback is shown under the wrong heading | **P2** | Defect + missing spec | api+web |
| **F8** | Portfolio page is unusable at mobile width | **P2** | Defect | web |
| **F9** | `not_assessed` is visually indistinguishable from absent data | **P2** | Missing spec | web |
| **F10** | Evidence quotes render with doubled quotation marks | **P3** | Defect | web |
| **F11** | Fallback narrative has a grammar defect (`1 gaps`) | **P3** | Defect | api |
| **F12** | Setup documentation is stale; a fresh install cannot be logged into | **P3** | Defect + missing spec | repo |
| **F13** | A vacancy with no skills kills the fit/gap job and leaves the UI polling forever | **P2** | Defect | api |

---

## 4. Findings in detail

### F1 — P0 — The required level is invisible on the deciding screen
**Defective implementation · api + web (the computation/presentation seam)**

- **Ideal:** PRD-02 Phase 5 specifies the report as a table with a `Required`
  column (`L3`, `L3`, `L2`). `Exports::PdfGenerator` agrees and reads
  `c['expected_level']` (`api/app/services/exports/pdf_generator.rb:128`).
- **Actual:** `FitGap::Engine` serialises the key as `expected_level`
  (`api/app/services/fit_gap/engine.rb:62`). The UI type declares
  `required_level: number` as **required** (`web/src/types/index.ts:132`) and
  `ComparisonTable` reads `LEVEL_LABELS[c.required_level]`
  (`web/src/components/fitgap/ComparisonTable.tsx:50`). The key never exists,
  the lookup yields `undefined`, React renders nothing.
- **Evidence:** live payload — every entry carries `"expected_level": 3`, none
  carries `required_level`. Screenshot `01-ui-before-fitgap.png` shows the
  `Required` header above six empty cells.
- **Why TypeScript did not catch it:** the response is cast at the axios boundary
  with no runtime validation, so a compile-time contract describes a shape the
  server never sends. See Constraint Signal CS-4.
- **The same data is correct in the PDF and wrong in the web UI** — one payload,
  two renderers, one broken.
- **Impact:** the recruiter sees that a candidate scored L2 without being told
  the role demands L3, so the screen cannot support the comparison it exists to make.

### F2 — P0 — The human override is applied but invisible
**Defective implementation · api + web (seam)**

- **Ideal:** the UI's own legend promises it — *"✏ = human override applied"*
  (`ComparisonTable.tsx:76`). PRD-02 Phase 5 has the assessor review and correct
  AI ratings; that correction is the product's only human-in-the-loop control.
- **Actual:** `ComparisonTable.tsx:56` reads `c.is_override`, which
  `FitGap::Engine` never emits (`engine.rb:58-66` sends
  `skill_label, skill_id, candidate_level, expected_level, result, delta, confidence`).
  The marker is unreachable code.
- **Evidence:** a genuine override exists in the database — Communication, AI
  `L2` → assessor `L3`, with the note *"Listened back to this section. He did
  adapt the framing for a non-technical audience, which the anchor puts at L3…"*.
  The engine **uses** it (`engine.rb:81`), so the row reads `Match`. The payload
  contains no `is_override`, and no ✏ appears in `01-ui-before-fitgap.png`.
- **Aggravating factor:** the Portfolio page *does* show it (`L2 AI → L3 You
  Overridden ✓`, screenshot `02-…-portofolio…png`). The information is
  therefore known, rendered elsewhere, and lost precisely on the screen where the
  decision is made.
- **Impact:** an assessor's documented correction silently disappears from the
  deciding table, so a reviewed judgement is indistinguishable from a raw machine one.

### F3 — P1 — Evidence strength is computed, transmitted, then discarded
**Missing specification + defective implementation · api + web (seam)**

- **Ideal (first principles — the PRD never defines this):** PRD-01 §5 defines
  how confidence is *assigned* (`high` when `probe_count >= 3 AND state = covered`,
  down to `low` at `probe_count <= 1`). No document states how uncertainty must be
  *presented* to the person deciding. That silence is the missing specification.
- **Actual:** `FitGap::Engine` computes `result` purely as
  `candidate_level - expected_level` (`engine.rb:47-56`) — confidence is not an
  input. The engine does emit `confidence:` (`engine.rb:65`), but
  `SkillComparison` does not declare the field (`types/index.ts:130-137`) and
  `ComparisonTable` never renders it.
- **Evidence, from the live report:** `React / Frontend Development Core` →
  `Match`, `confidence: high`, 3 quotes. `Micro-frontend Architecture` → `Match`,
  `confidence: low`, 1 quote, coverage state still `partial`. **Both render as an
  identical `✅ Match` badge.**
- **Impact:** a rating the system itself labelled low-confidence is presented with
  the same visual authority as its best-evidenced one, so the reviewer cannot tell
  a measurement from a guess.

### F4 — P1 — `medium` confidence is displayed as "confirmed"
**Defective implementation · web**

- **Actual:** `FitGapReportPage.tsx:196`

  ```tsx
  {s.ai_level} ({s.ai_confidence?.toLowerCase() === "low" ? "low confidence" : "confirmed"})
  ```

  A three-valued enum (`high`/`medium`/`low`) is collapsed to two. Everything that
  is not `low` — including **`medium`** — is labelled **"confirmed"**.
- **Impact:** the system's own word for *middling evidence* is rewritten on screen
  as the word for *verified*, actively inverting the signal it was built to carry.

### F5 — P1 — The page contradicts itself about the same skill
**Defective implementation · web**

- **Actual:** the "Discovered Skills" panel filters `portfolio.skills` by
  `is_discovered` — a flag belonging to the *portfolio* — and hardcodes the label
  *"Not required for this role, may be additive."* (`FitGapReportPage.tsx:179-198`).
  It never consults the vacancy.
- **Evidence:** the vacancy **does** require `Micro-frontend Architecture` at L2,
  so the table above lists it as a matched requirement — while the panel below
  declares it not required. Both statements are on screen simultaneously in
  `01-ui-before-fitgap.png`.
- **Impact:** the report asserts two contradictory things about one skill on a
  single screen, which destroys the reader's warrant to trust either.

### F6 — P0 — Portfolio records are reachable and writable across tenants
**Defective implementation · api**

- **Ideal:** tenant isolation is the product's stated model — `TenantScoped`
  applies a `default_scope` on `Current.tenant_id`
  (`api/app/models/concerns/tenant_scoped.rb:18-24`).
- **Actual:** `Portfolio`, `PortfolioSkill`, `AssessorOverride`, `TranscriptTurn`,
  `CoverageMap` and `FitGapReport` neither include `TenantScoped` nor carry a
  `tenant_id` column (`api/db/schema.rb`). Controllers reach them by primary key
  with no ownership check: `PortfolioSkill.joins(:portfolio).find(params[:id])`
  (`portfolio_skills_controller.rb:51`), and `Portfolio.find(params[:id])`
  (`portfolios_controller.rb:82, 104, 130, 156`).
- **Proven, then fixed.** This was first reported at P1 with the note that it had
  only been read from source. A request spec now drives the real middleware stack
  with a valid, correctly signed `admin` token belonging to a *different*
  organisation than the records it touches. Against the original code:

  ```
  POST /api/v1/portfolio_skills/6/override        -> HTTP 201 Created
       AssessorOverride persisted: override_level 5, overridden_by 99,
       on a portfolio skill owned by another organisation

  GET  /api/v1/portfolios/1/export?format=json    -> HTTP 200
       body contained the candidate's name and their verbatim interview quotes
  ```

  Four of seven examples failed. With evidence it is a **P0**, and the initial
  P1 was the right call only for as long as the claim was unverified — a claim is
  worth what its evidence is worth.

  One example passed from the start: the same portfolio reached through
  `GET /api/v1/sessions/:id/portfolio` was already refused, because `Session`
  includes `TenantScoped`. The mechanism works where it is applied; the defect is
  that it is not applied to derived records.

  **Fix:** ownership here is transitive — portfolio → session → tenant — so an
  `in_tenant` scope expresses that and the controllers use it. A foreign id now
  raises `RecordNotFound` and returns 404, which also declines to confirm the id
  exists. Verified: 7 examples, 0 failures, and the owning tenant is not
  over-blocked.
- **Not closed by this fix — see CS-1.** Isolation for these six models is still
  enforced by controller discipline rather than by the data layer. The next
  controller to add a bare `.find` reopens the same hole.
- **Impact:** an assessor authenticated for one organisation could read and alter
  another organisation's candidate ratings, quotes and exports.

### F7 — P2 — Model failure is silent and the fallback is mislabelled
**Defective implementation + missing specification · api + web**

- **Actual:** when the narrative call fails, `Engine#generate_narratives` rescues
  and returns `{ culture: nil, overall: <fallback string> }`
  (`engine.rb:105-108, 141-147`). The page renders
  `report.culture_narrative || report.overall_narrative`
  (`FitGapReportPage.tsx:173`) beneath the heading **"Culture & Competency Fit"**.
- **Evidence:** the live report displays *"Candidate shows 3 skill matches, 1
  exceeds, and 1 gaps against role requirements."* under that heading. That string
  is the mechanical fallback, not a culture assessment, and nothing on screen
  indicates the model call failed. `overall_narrative` additionally has no heading
  of its own, so when the call *succeeds* the overall recommendation is not shown
  at all.
- **Impact:** a counted summary is presented to the reader as a qualitative
  culture-fit judgement, with no signal that the analysis it replaced never ran.

### F8 — P2 — The portfolio page collapses at mobile width
**Defective implementation · web** *(found by the author while walking the workflow)*

- **Ideal:** the brief names responsive views as a required interaction state and
  lists neglected UI/UX quality as a disqualifier.
- **Actual:** at narrow widths the skill card does not reflow. Content is squeezed
  into a ~110 px column beside a large empty region, body text wraps to one or two
  words per line, and the header row overflows so the override control truncates
  to `Edit ov…`. On the fit/gap page the vacancy selector cannot be operated at
  all. Screenshot `02-ui-before-portofolio(can't choose vacancy when mobile view).png`.
- **Impact:** a hiring manager reviewing on a phone cannot read the evidence or
  reach the override control, which are the two things the screen exists for.
- **Correction, recorded in `ai-verification-log.md` as VER-04.** The first
  attempt at this fix changed Tailwind classes on two components and declared the
  finding resolved on the strength of a green Vitest run. Those tests execute in
  jsdom, which performs no layout and never evaluates a media query, so that
  evidence said nothing about reflow. The actual cause was the application
  shell — `AssessorLayout`'s non-wrapping flex header, inherited by every page —
  which no component-level patch could have fixed. Acceptance is now a
  measurement taken in a real browser: below the `sm` breakpoint every page
  reports `documentElement.scrollWidth === clientWidth` with no element extending
  past the viewport.

### F9 — P2 — Absence of evidence is presented as evidence of absence
**Missing specification · web**

- **Actual:** `result: 'not_assessed'` renders as a plain `—`
  (`ComparisonTable.tsx:18, 58-60`), carrying the same visual weight as an empty
  cell. No document defines how an unassessed requirement should be presented.
- **Evidence:** `Testing & Quality Assurance` is required at L3 and was never
  probed; the live payload returns
  `{"result": "not_assessed", "candidate_level": null, "confidence": null}`.
- **Impact:** a required skill that was never asked about looks like a blank,
  inviting the reader to infer the candidate lacks it.

### F10 — P3 — Evidence quotes render with doubled quotation marks
**Defective implementation · web** — stored quotes already contain literal `"`
characters and the card adds its own, producing `""I put together a one-pager…""`
(screenshot `02-…-portofolio…png`). *Impact:* the verbatim evidence that justifies
a rating looks malformed, which cheapens the most defensible part of the report.

### F11 — P3 — Grammar defect in the fallback narrative
**Defective implementation · api** — `engine.rb:146` interpolates counts without
pluralisation, yielding *"1 gaps"*. *Impact:* the artifact a recruiter may forward
to a hiring manager reads as unfinished.

### F13 — P2 — A vacancy with no skills kills the job and the UI waits forever
**Defective implementation · api** *(found by a spec, not by reading)*

- **Actual:** `Vacancy` validates only `role_title`, so a vacancy with zero
  skills is legal. `FitGapReport` validated `skill_comparisons` with
  `presence: true`, and Rails treats `[]` as blank — so `update!` raised
  `ActiveRecord::RecordInvalid`, `FitGapGeneratorWorker` (`retry: 2`) exhausted
  its retries, and the job died. The page polls a report that will never arrive
  and shows "Generating fit/gap report…" indefinitely, with no error anywhere.
- **Evidence:** an edge-case example written before any fix —
  *"produces an empty comparison list for a vacancy with no skills"* — failed on
  `Validation failed: Skill comparisons can't be blank` at `engine.rb:26`.
- **Fixed:** the validation now requires a list and permits an empty one, and the
  table renders an explicit empty state naming the cause ("This vacancy has no
  required skills defined yet").
- **Impact:** an assessor who runs fit/gap against a half-configured vacancy
  waits on a spinner that will never resolve, with nothing telling them why.

### F12 — P3 — A fresh install cannot be logged into, and the docs are stale
**Defective implementation + missing specification · repo**

- `db/seeds.rb` creates an organisation and 22 taxonomy skills but **zero users**
  (`ai_interview.users` is empty after seeding), while
  `authentication_controller.rb:10-14` requires a persisted user with role
  `admin`. The documented path is instead to mint a JWT by hand and paste it into
  `VITE_DEV_TOKEN`, printed at `seeds.rb:385-397`.
- `web/README.md` and `web/.env.example` both default the API to port **3000**;
  it serves on **3001**. `api/README.md` step 7 instructs `cd ../ai-interview-web`,
  a directory that does not exist — the frontend is `web/` in this same repo.
- *Impact:* a new engineer following the README gets a UI that renders perfectly
  and silently fails every request, which is the most expensive kind of onboarding
  bug because nothing announces itself as broken.

---

## 5. Missing specification vs defective implementation

| Missing specification (never defined) | Defective implementation (defined but broken) |
|---|---|
| **F3** — how uncertainty must be presented at the decision surface. PRD-01 §5 defines how confidence is *assigned*, never how it is *shown*. | **F1, F2** — PRD-02 and `PdfGenerator` both specify a Required column and an override marker; the web UI fails to deliver either. |
| **F9** — how an unassessed requirement should be distinguished from a gap. | **F4, F5, F10, F11** — straightforward rendering and formatting errors. |
| **F7 (part)** — no defined behaviour for a degraded report when the model call fails. | **F6** — tenant isolation is defined by `TenantScoped` and simply not applied to derived models. |
| **F12 (part)** — no defined bootstrap identity for a fresh environment. | **F7 (part), F12 (part)** — the fallback is mislabelled; the docs contradict the code. |

The distinction matters for what we do next: a defect is fixed by making the code
match the spec, while a missing specification must first be **decided** — and the
decision belongs in the report, not silently in a commit.

---

## 6. Constraint Signals

Blocking risks, ambiguities, and architectural debt I would escalate to a
Technical Lead on day one rather than resolve unilaterally.

**CS-1 — Tenant isolation is enforced by controller discipline, not by the data layer.**
`TenantScoped` covers only `Assessment`, `Session` and `Vacancy`. Every derived
record (portfolios, skills, overrides, transcripts, coverage, fit/gap reports)
relies on each controller remembering to scope its lookup, and several do not
(F6). This is architectural, not a local bug, and the remedy is a design decision:
a `tenant_id` column on every table, PostgreSQL row-level security, or a mandatory
scope enforced in a base class. Patching individual controllers would hide the
class of bug without removing it.

**CS-2 — `advance_stale_partials` silently redefines what "covered" means.**
`coverage_analyzer_worker.rb:91-101` promotes `partial → covered` whenever
`probe_count >= 4`, justified in its own comment as a workaround for skills
falling outside the analyser's 6-turn sliding window — no model ever confirms the
evidence is sufficient. That state then becomes `confidence: high` in the
portfolio prompt (`portfolios/generator.rb:98-101`) and lets `all_covered?`
(`coverage/map_injector.rb:48-58`) end the interview early. A technical limitation
is thereby converted into a product claim about a candidate. This needs a product
decision, not an engineering patch. *(Read from source; the runtime behaviour is
not independently verified — see C4 in `ai-verification-log.md`.)*

**CS-3 — Neither service has tests or CI.**
`api/spec/` does not exist despite RSpec being installed; `web/package.json` has
no test runner and no `test` script; there is no `.github/workflows`. Every change
shipped today is unprotected. Building the harness is therefore part of the
change, not preparation for it.

**CS-4 — The frontend trusts the API contract with no runtime validation.**
Responses are cast at the axios boundary (`web/src/services/api.ts`), so
TypeScript describes the shape the frontend *wishes* it received. This is the root
cause of F1 and F2 rather than an incidental detail: the compiler reported success
on a required field the server has never once sent. Any fix that renames a key
without addressing this leaves the next contract drift equally silent.

**CS-5 — The published specification is an extract.**
The node notation implies N1–N14, but **N3 and N12 are defined nowhere** in either
PRD or in the source, and the coverage-injection step is called `B6` in PRD-01 and
`N8` in PRD-02's runtime trace. See `assumptions.md` A11. An inheriting engineer
cannot tell whether these were cancelled, renumbered, or simply not published.

---

## 7. Where this leads

F1, F2, F3 and F9 are one problem wearing four faces: **the fit/gap surface is
where the product's own evidence is thrown away.** They share a single seam, a
single payload, and a single component, and they are the findings that sit closest
to the harm — a candidate rejected on a guess that was presented as a measurement.

That is the change taken forward into Step 4, with F4, F5, F7, F10 and F11 fixed
in passing because they live in the same two files.

F6 was initially in that escalate-rather-patch category, and moving it was a
deliberate change of mind: proving it with a request spec was cheap, and once
proven, shipping a demonstrated P0 unfixed is a weaker position than closing the
endpoints and escalating the class of bug. The narrow fix landed; CS-1 stands.

CS-1 and CS-2 remain reported and escalated rather than patched, for reasons
argued in the Step 4 trade-off analysis.
