# Self-derived acceptance criteria

No specification was provided, so correct behaviour was defined before writing
code. Each row states the input, the behaviour required, where it is enforced,
and the spec that proves it.

The organising principle: **the system must never manufacture a fact about a
person.** Where evidence is absent, ambiguous or unparseable, the correct output
is a recorded absence — never a number that looks like a finding.

## Model output

| Input | Required behaviour | Enforced in | Proven by |
|---|---|---|---|
| `level` key absent | `insufficient_evidence`, `ai_level` nil | `ResponseContract#parse_level` | `generator_spec` "omits the level key" |
| `level: null` | `insufficient_evidence`, nil — **never L1** | same | "returns a null level" |
| `level: 0` / `9` / `-2` | `insufficient_evidence` — refused, **not clamped** | same | "returns a level outside 1..5" |
| `level: "L3"` | Accepted as `3` (unambiguous) | same | "accepts the unambiguous L3 string form" |
| `confidence: "very high"` | Downgraded to `low`, issue recorded | `#parse_confidence` | "downgrades an unrecognised confidence" |
| `evidence` is an object | Dropped to `[]` — never `[[k,v]]` pairs | `#parse_evidence` | "drops evidence returned as an object" |
| `competency_summary` blank | Neutral placeholder, issue recorded | `#parse_summary` | contract-level |
| Same skill returned twice | First wins; no duplicate row | `#index_model_skills` + unique index | "does not create duplicate rows" |
| Skill absent from the coverage map | Dropped — a portfolio describes the interview, not the model's recall | `#note_unmatched` | "drops a skill that is not in the session coverage map" |
| Skill in coverage map but omitted by model | `insufficient_evidence` | `#build_skill` | contract-level |
| Response is not JSON | Portfolio `failed`; nothing written | `Generator#call` | "marks the portfolio failed when the response is not JSON" |
| Response is `{}` | `EmptyResponseError`; nothing written | same | same path |

## Coverage authority

| Input | Required behaviour | Proven by |
|---|---|---|
| `state: not_yet`, `probe_count: 0` | `not_probed`, no level, no confidence | "is recorded as not_probed with no level, and never as L1" |
| Coverage says unprobed, **model rates it anyway** | Coverage wins; rating discarded | "refuses a rating even when the model supplies one anyway" |
| Unprobed skill's summary | Explains the absence, never blank | "explains the absence rather than leaving the summary blank" |

## Failure paths

| Condition | Required behaviour | Proven by |
|---|---|---|
| Gemini timeout (portfolio) | Portfolio `failed`, error recorded, re-raised for Sidekiq | "marks the portfolio failed and re-raises on timeout" |
| Gemini timeout (narrative) | Rule-based comparison still persists; `narrative_status: failed` | `engine_spec` "still persists the rule-based comparison" |
| Write fails partway | **Complete** rollback — zero rows, not "fewer" | "rolls back completely when a write fails partway through" |
| Duplicate Sidekiq delivery | No-op; one portfolio, one set of skills | "is idempotent when the same job is delivered twice" |
| Concurrent regeneration | Advisory lock; loser exits without touching state | `Generator#acquire_write_lock!` |
| Error column contents | Class and message only — never model output or transcript | "does not write model output into the error column" |

## Fit/gap comparison

| Input | Required behaviour | Proven by |
|---|---|---|
| Skill assessed, level = required | `match` | `engine_spec` |
| Skill `not_probed` / `insufficient_evidence` | `not_assessed` — **never `gap`** | "is reported as not_assessed, never as a gap" |
| Assessor override present | Compare against the **human** rating | "compares against the human rating, not the model rating" |
| Override present | `is_override`, `ai_level` and `override_level` all emitted | "shows the provenance of the rating it used" |
| Portfolio skill absent from vacancy | Appears as `additional`, not dropped | "still appears, rather than being dropped" |
| `"React "` vs `"React"` | Matched (strip + downcase) | "matches across surrounding whitespace and case" |
| Vacancy with zero skills | Empty comparison; UI shows an explanatory empty state | `ComparisonTable.test` "renders an explanatory empty state" |

## Data protection (UU PDP)

| Input | Required behaviour | Proven by |
|---|---|---|
| Tenant A requests tenant B's portfolio | **404**, never 403 — 403 confirms existence | `portfolio_tenant_isolation_spec` (4 examples) |
| Tenant A exports tenant B's portfolio | 404; no evidence quotes in the body | "leaks no evidence quotes in the refusal body" |
| Tenant A overrides tenant B's skill | 404; nothing persisted; existing override unchanged | 3 examples |
| Tenant A triggers fit/gap on tenant B | 404; **no job enqueued** | "enqueues no work on behalf of an intruder" |
| Owning tenant does the same | Succeeds | 4 paired positive examples |
| No tenant in context | Scope returns `none` (fails closed) | "fails closed when there is no tenant in context" |
| Worker given a portfolio and vacancy from different tenants | Refuses; no report written; not retried | `fit_gap_generator_worker_spec` (3 examples) |
| Any log line | No transcript text, quotes, names or emails | `Generator#log_issues` — skill labels only |

## Client contract

| Input | Required behaviour | Proven by |
|---|---|---|
| Payload omits `required_level` | Throws `ContractError` naming the field — **never renders blank** | `schemas.test` "rejects a payload that omits required_level" |
| `candidate_level` out of 1..5 | Rejected rather than rendered | "rejects a level outside 1..5" |
| `candidate_level: null` | Accepted — how an unassessed skill arrives | "allows a null candidate level" |
| `required_level: null` | Accepted — a skill outside the vacancy | "allows a null required_level" |

## Interface states

| State | Required behaviour | Proven by |
|---|---|---|
| Portfolio fetch fails | Error state with the message and a retry | `FitGapReportPage.test` "shows an error state with a retry" |
| Retry succeeds | Recovers to the report | "recovers when the retry succeeds" |
| No portfolio yet | Empty state explaining what is needed | "explains itself when the session has no portfolio yet" |
| Worker never finishes | Polling stops at ~2 min; manual re-check offered | "stops polling and offers a way out instead of spinning forever" |
| Regeneration request fails | Error surfaced, not an unresolvable spinner | "surfaces a failed regeneration" |
| Narrative failed | Stated as unavailable; comparison still shown | "does not present a failed narrative as a culture analysis" |
| Unassessed skill in the table | Neutral styling, no level, no confidence chip | 3 examples in `ComparisonTable.test` |
| Unassessed skill on the portfolio card | No level badge at all; state explained | `SkillPortfolioCard` |
| Long skill label / quote | Truncates with title attribute; never overflows | `ComparisonTable` |
| Viewport < 768px | Table becomes stacked cards | `ComparisonTable` |
