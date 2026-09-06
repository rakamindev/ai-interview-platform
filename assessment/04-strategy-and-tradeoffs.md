# Step 4 — Revamp Strategy, Acceptance Criteria & Trade-offs

## 1. The gap to bridge

The system computes how much evidence stands behind each judgement — `probe_count`,
a four-state coverage machine, an explicit `ai_confidence`, and verbatim quotes —
carries all of it into the API payload of the final screen, and then presents a
level and a badge. The ideal condition is not more analysis; the analysis already
exists. It is that **the uncertainty the system already knows about survives the
last six inches to the human eye**, and that the human's own correction survives
with it.

That framing decides the shape of the change: this is a *seam* problem, so the
work is a thin, deep vertical slice through both services rather than a feature.

---

## 2. Solution options

The real design question is not "which files do we touch" but **where uncertainty
should enter the decision**. Three coherent answers:

### Option A — Carry the evidence through and let the human weigh it *(chosen)*

The engine keeps deciding `match`/`gap`/`exceed`/`not_assessed` from levels
alone. The payload additionally carries `confidence`, `evidence_count`,
`is_override` and `ai_level`. The table renders them so a reader can see what
each verdict rests on.

### Option B — Fold confidence into the verdict itself

Change the engine so a low-confidence gap becomes a distinct outcome —
`provisional_gap`, or a `gap` suppressed below an evidence threshold. The system
decides how much a thin rating counts.

### Option C — Fix the class of bug: runtime contract validation

Introduce schema validation (zod) at the axios boundary, so a response that does
not match the declared type fails loudly instead of rendering `undefined`.
Optionally generate the TypeScript types from the Rails serialisers.

### Evaluation

| | **A — present it** | **B — decide it** | **C — prevent it** |
|---|---|---|---|
| **Product impact** | High. Restores the comparison, makes two visually identical verdicts distinguishable, and makes the human override visible. The assessor gains the ability to calibrate, which is what makes a decision defensible. | High but **pointed the wrong way**. It reduces what the human has to think about, in a product whose defect is already too much machine confidence. It solves the symptom by taking the judgement further from the person accountable for it. | Zero today, high over time. It fixes nothing a user can see; it prevents the next twenty defects of this kind. |
| **Cost** | Low. Three fields in one serialiser, one component, one migration. Landed with 52 tests in an evening. | Medium code cost, **high decision cost**. What threshold? Set by whom? Does a `low`-confidence exceed also get suppressed? Nobody has made that product decision, and inventing it inside an engine is how policy becomes folklore. | High. Every service call, every type, plus a schema-drift story between two languages. Not landable safely under this deadline. |
| **Maintainability** | Good. Additive fields, no behaviour changed for existing consumers. `Exports::PdfGenerator` keeps working untouched. Trivially reversible — deleting the fields restores the old payload. | Poor. The threshold becomes a magic number nobody can justify in a year. Changing it silently re-scores every historical report, and `result` is stored in JSONB so history and live disagree. | Excellent, and the correct end state. But it needs an owner: schema drift between Rails and TypeScript is a standing maintenance obligation, not a one-off. |
| **Failure modes** | If the model omits `confidence`, the chip is absent and the count still renders — the row degrades to today's behaviour, which is the safe direction. If `evidence` is null, the count reads 0 rather than crashing. | A miscalibrated threshold silently hides real gaps, and the failure is *invisible* — nobody sees the verdict that was suppressed. This is the worst failure shape available: wrong, confident, and quiet. | Strict validation turns a cosmetic drift into a hard error. Correct in principle; without a rollout plan it converts one blank column into a blank page. |
| **Contextual fit** | Fits a codebase with no tests and no CI, because it is small enough to cover completely and to explain in a defence. Directly answers the brief's "the data computation and frontend presentation seam". | Fits a mature product with a product owner available to set the policy. Neither is true here. | Fits the next sprint, with a lead who has agreed to own the contract. |

### Chosen: A, with C recommended as the immediate follow-up

**Why A over B.** B is the tempting option because it looks more sophisticated —
the system becomes smarter. But the product's failure is that it is *already too
confident on the user's behalf*. Automating the weighing pushes the decision
further from the accountable human, which is the wrong direction both
practically and under UU PDP, where the human review is what stops the outcome
being purely automated processing. A restores information to the person
accountable; B removes their opportunity to use it.

**Why A over C now.** C is the correct fix for the *root cause* — and Step 3
records it as constraint signal CS-4 for exactly that reason. But C on its own
leaves the Required column blank, because a validator that rejects the payload
still does not render it. A ships the user-visible fix; C prevents the next one.
Doing A first and C next is the right order; doing C first would be engineering
that never reaches a user.

**What A forecloses.** Almost nothing, which is part of its appeal. The fields
are additive, so B remains available later once someone owns the threshold
decision, and C sits on top of A rather than replacing it.

---

## 3. Self-derived acceptance criteria

The brief asks for these to be written before coding. Most were — they are what
the initial failing specs asserted. **Two were not**, and I have marked them,
because a criteria list that pretends to perfect foresight is less useful than an
honest one.

### Contract

| # | Input | Required behaviour | Pinned by |
|---|---|---|---|
| A1 | Any comparison row | The level the role requires is rendered, from the field the API actually sends (`expected_level`) | `ComparisonTable.test.tsx` — "renders the level the role requires for every row" |
| A2 | Candidate meets / is below / exceeds the required level | `match` / `gap` with negative delta / `exceed` with positive delta | 3 engine examples |
| A3 | Vacancy skill has a `skill_id` and the portfolio label was renamed | Matches on the stable id, not the label | engine — "matches on skill_id ahead of label" |
| A4 | Custom skill with no `skill_id`, differing letter case | Falls back to a case-insensitive label match | engine — "falls back to a case-insensitive label match" |

### Evidence and provenance

| # | Input | Required behaviour | Pinned by |
|---|---|---|---|
| A5 | Rating carries `ai_confidence` | Confidence is visible on the row, rendered verbatim — never re-interpreted | `ComparisonTable.test.tsx`, and the removal of the `!== "low" ? "confirmed"` branch |
| A6 | Rating supported by *n* quotes | The count is visible, so a 3-quote match is distinguishable from a 1-quote match | engine + component examples |
| A7 | An assessor overrode the level | The row is marked, and the superseded model level is shown struck through | `is_override` + `ai_level` in the payload; component example |
| A8 | No override | `is_override` is `false`, not absent — an absent key is indistinguishable from "not overridden" at the boundary that already failed once | engine — "leaves is_override false when the level is the model's own" |

### Unassessed and missing data

| # | Input | Required behaviour | Pinned by |
|---|---|---|---|
| A9 | Vacancy requires a skill the interview never covered | `not_assessed`, `candidate_level` null, `delta` null — **never** a `gap` | engine — "is reported as not_assessed rather than as a gap" |
| A10 | Same row, in the UI | Reads as *"Never probed"* with a dashed row, and is counted separately in the summary. Absence of evidence must not read as evidence of absence | component — "does not present an unassessed skill as a gap", "counts unassessed requirements in the summary" |
| A11 | Unassessed row | No confidence chip is rendered, and `evidence_count` is `0` | engine + component |
| A12 | Model returned no quotes at all | `evidence_count` is `0`, not `nil`; the row renders rather than crashing | engine — "reports zero evidence rather than nil" |

### Failure paths

| # | Input | Required behaviour | Pinned by |
|---|---|---|---|
| A13 | Narrative model call times out or errors | The rule-based comparison table is still produced — it needs no model | engine — "still produces the rule-based comparison table" |
| A14 | Same | The report records `narrative_degraded: true`, and the UI says the analysis did not run rather than presenting a count as a culture assessment | engine + `FitGapReportPage` |
| A15 | Same | No culture narrative is invented | engine — "does not invent a culture narrative" |
| A16 | The same portfolio/vacancy pair is generated twice (duplicate job, retry) | The existing report is updated, never duplicated | engine — "updates the existing report instead of creating a second one" |
| A17 | **Vacancy with no skills defined** *(derived during implementation, not before — found by an edge-case spec that failed with `RecordInvalid`)* | An empty comparison list is a valid, storable report; the UI shows an explicit empty state naming the cause. The job must not die and leave the UI polling forever | engine — "produces an empty comparison list for a vacancy with no skills"; component — "renders an explicit empty state" |
| A18 | Any authenticated user requesting a portfolio record they do not own *(derived during implementation — the finding existed, the criterion did not until a request spec proved it)* | 404, and nothing is written | `tenant_isolation_spec.rb`, 7 examples |

### Data shape and presentation edges

| # | Input | Required behaviour | Pinned by |
|---|---|---|---|
| A19 | A 4 000-character competency summary | Stored and rendered without truncation or error | engine — "preserves long competency text" |
| A20 | A skill label far longer than its column | The row still renders and the required level is still reachable | component — "renders a very long skill label without dropping the row" |
| A21 | Evidence quote arriving already wrapped in quotation marks | Rendered inside exactly one pair; a quotation containing quotation marks keeps its inner ones | `evidence.test.ts`, 12 examples |
| A22 | Viewport below the `sm` breakpoint | Every page reflows — `documentElement.scrollWidth === clientWidth`, no element past the viewport. **Verified in a real browser, never from a jsdom suite** (see VER-04) | measured against the running app |
| A23 | Counts of 0, 1 and many in the fallback summary | Grammatical in every branch — "1 gap", "2 skills meet" | engine — two examples, the second added after a real run showed "3 skill meetss" |

---

## 4. Trade-offs accepted, stated plainly

**The engine still ignores confidence when choosing the badge.** A `gap` is a
`gap` whether it rests on one quote or five. That is Option B territory and it is
deliberately left undone — the badge answers "does the candidate meet the bar",
and the adjacent columns answer "how much should you trust that". Merging the two
questions requires a threshold nobody has been asked to set.

**Tenant isolation is fixed at the controller, not the data layer.** The
endpoints that leaked are closed and covered by specs. The class of bug is not:
the next bare `.find` on a portfolio record reopens it. Escalated as CS-1.

**The contract is still cast, not validated.** Option C is not in this change.
The renamed field is correct today; nothing prevents the next drift from being
equally silent. Escalated as CS-4.

**`advance_stale_partials` is untouched.** It promotes `partial → covered` on
probe count alone, which becomes `confidence: high` downstream and can end an
interview early. That is a product decision about what "covered" means, not an
engineering defect to patch under a deadline. Escalated as CS-2.

Each of these is a deliberate stopping point with a written reason, which is the
distinction between scope discipline and an unfinished job.

---

## 5. What I would do next, in order

1. **Option C** — runtime validation at the axios boundary, starting with the
   fit/gap and portfolio responses. Highest leverage per hour of anything left.
2. **CS-1** — a design decision on tenant isolation, then implement it once.
3. **CS-2** — a product conversation about `advance_stale_partials`, because the
   right answer might be to remove the auto-promotion entirely and let a skill
   stay `partial` honestly.
4. **Give the candidate their portfolio.** The largest unrealised value in the
   product, and the clearest answer to the brief's fifth pillar.
