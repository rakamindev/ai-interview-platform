# Step 4 — Revamp Strategy, Acceptance Criteria & Trade-offs

## Goal

Turn the Fit/Gap report into a **trustworthy decision surface**: correct, honest about uncertainty, always in a defined state, tenant-isolated.

## Options considered

| | **A. Patch the seam** | **B. Report as a stateful, versioned entity** *(chosen)* | **C. Event-driven recompute + push** |
|---|---|---|---|
| What it is | Rename `required_level` in the web, add `is_override` to JSON, cap polling | Add `status`, `inputs_digest`, `narrative_source`, `error_message` to `fit_gap_reports`; pure comparator; idempotent worker; tenant-guarded endpoints; redesigned screen driven by status | Recompute on every override via domain events; push updates over the existing WebSocket stack; per-version history table |
| Product impact | Fixes the blank column only. Infinite spinner, vanishing report, low-confidence "gaps", cross-tenant reads remain | Every row correct and labelled; report never disappears; outdated/failed are visible states with a next action; low-confidence and not-assessed are explicit | Same as B plus live updates and full history |
| Cost | ~0.5 day | ~3 days incl. tests | ~6–8 days; WebSocket infra is audio-tuned and untested |
| Forecloses | Nothing, but leaves the trust problem | Nothing: digest + status are the prerequisites for C | Locks into an event bus before the domain is stable |
| Maintainability | Trivial | One migration (reversible), one pure class, one worker; easy to read and to walk back (`down` drops 4 columns) | Many moving parts; hard to walk back |
| Failure modes | Any worker failure → spinner forever | Model outage → deterministic fallback narrative flagged as such; worker crash → `failed` with retry; duplicate enqueue → no-op | Message loss / ordering bugs; socket reconnect storms |
| Fit for this codebase & deadline | Too shallow for the brief | Reuses the existing `generation_status` enum, polling hook, and shadcn components | Too much risk for the deadline |

**Decision: B.** It fixes the root cause (a report has no lifecycle and no provenance) with one reversible migration, and it is the foundation C would need anyway.

## Contract (API → web)

```jsonc
// GET /api/v1/portfolios/:id/fitgap/:vacancy_id
{
  "report": {
    "id": 1, "portfolio_id": 1, "vacancy_id": 1,
    "status": "complete",              // pending | generating | complete | failed
    "stale": false,                    // inputs changed since generation (e.g. new override)
    "error_message": null,             // safe, user-facing; never raw exception text
    "narrative_source": "ai",          // ai | fallback | null
    "generated_at": "…",
    "summary": { "total": 4, "match": 1, "gap": 1, "exceed": 1, "not_assessed": 1, "needs_verification": 1 },
    "skill_comparisons": [{
      "skill_label": "Communication", "skill_id": "communication",
      "expected_level": 3, "candidate_level": 2, "ai_level": 2,
      "is_override": false, "assessor_notes": null,
      "confidence": "low", "needs_verification": true,
      "result": "gap", "delta": -1, "not_assessed_reason": null
    }],
    "culture_narrative": "…", "overall_narrative": "…"
  }
}
```

## Acceptance criteria

### Computation (`FitGap::Comparator`, pure)
| # | Given | Then |
|---|---|---|
| AC1 | Vacancy skill with matching portfolio skill (by `skill_id`, else normalised label: case, whitespace, punctuation) | `result` = match / gap / exceed from `candidate_level − expected_level`; `delta` integer |
| AC2 | Vacancy skill absent from portfolio (never probed) | `result: not_assessed`, `candidate_level: null`, `delta: null`, `not_assessed_reason: "not_probed"` — never counted as a gap |
| AC3 | Portfolio rating missing or outside 1–5 (corrupt/legacy data) | `not_assessed`, reason `"invalid_rating"`; no exception |
| AC4 | Assessor override exists | `candidate_level` = override level, `ai_level` = AI level, `is_override: true`, notes included; `needs_verification: false` (a human judged it) |
| AC5 | AI confidence `low` and no override | result still computed but `needs_verification: true`; counted separately in summary |
| AC6 | Vacancy with zero skills | empty comparisons, all summary counts 0, report still `complete` |
| AC7 | Discovered skills (not in vacancy) | not in comparisons (shown separately in UI) |

### Generation lifecycle (engine + worker + endpoints)
| # | Given | Then |
|---|---|---|
| AC8 | First request for a portfolio×vacancy | report row created as `pending`, one job enqueued, `202` with report |
| AC9 | Request while `pending`/`generating` | no new job; `202` with current report |
| AC10 | Request when `complete` and inputs unchanged | `200`, no job |
| AC11 | Override saved | existing reports are **kept**, marked `pending`, re-enqueued; the read endpoint reports `stale: true` until regenerated; previous comparisons stay visible |
| AC12 | Gemini timeout / HTTP error / non-JSON / missing keys / missing API key | report `complete`, `narrative_source: "fallback"`, deterministic narrative that names gaps, not-assessed and needs-verification counts |
| AC13 | Unexpected error in computation or DB write | report `failed` with a safe `error_message`; Sidekiq retries; after retries exhausted status stays `failed` |
| AC14 | Duplicate job for the same pair (double click, override race) | at most one job computes at a time; a job whose inputs already match a complete report is a no-op |
| AC15 | Portfolio or vacancy deleted before job runs | job exits quietly, no exception storm |
| AC16 | Writes | comparisons + narrative + status written in one transaction (no half-written report) |
| AC17 | Portfolio regenerated | assessor overrides re-attached to the matching new skills (by `skill_id`/normalised label) inside one transaction |

### Security & data protection
| # | Given | Then |
|---|---|---|
| AC18 | Assessor of tenant A requests any portfolio/report/export/override of tenant B | `404` (no existence leak), nothing enqueued, nothing written |
| AC19 | Vacancy and portfolio from different tenants (worker) | report `failed` "tenant mismatch", nothing computed |
| AC20 | No/invalid token, or non-assessor role | `401` / `403` |
| AC21 | Invalid `vacancy_id` (blank, non-numeric, unknown) | `422` / `404` with message |
| AC22 | Logs | only IDs; `candidate_name`, `invite_token`, evidence, notes, transcript text filtered |
| AC23 | Narrative prompt | asks for "areas to probe", never a hire/no-hire recommendation |

### Presentation (web)
| # | State | Then |
|---|---|---|
| AC24 | Loading portfolio | skeleton matching final layout |
| AC25 | `pending`/`generating` | progress state; polling every 3s with backoff; stops after ~2 minutes with a "still working — check again" message |
| AC26 | `failed` | error card with safe message + Retry |
| AC27 | `complete` | summary chips (match/gap/exceed/not assessed/needs verification), per-row Required vs Candidate levels, provenance badges (AI / Override with note tooltip), low-confidence marker |
| AC28 | `stale` | previous report visible with an "Outdated — regenerating" banner |
| AC29 | Narrative fallback | labelled "Automatic summary (AI narrative unavailable)"; AI narrative labelled "AI-generated draft — verify before deciding" |
| AC30 | Long labels / long narrative | labels wrap/clamp without breaking layout; narrative collapsible |
| AC31 | ≤ 640px | rows render as stacked cards; no horizontal page scroll |
| AC32 | Empty vacancy | explicit empty state |
| AC33 | Portfolio not ready / failed | explanatory state with link back, no fit/gap trigger |

## Edge-case test data

Labels with mixed case/whitespace/punctuation (`"  react / FRONTEND development "`), Indonesian text with diacritics, 255-char labels, level `nil`, level `7`, confidence `"LOW"`, Gemini returning prose, Gemini returning `{}`, Gemini raising timeout, `GEMINI_API_KEY` unset.
