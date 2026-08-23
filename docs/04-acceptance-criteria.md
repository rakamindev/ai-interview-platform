# 04 — Acceptance Criteria

**Provenance: `[SPEC]` — written before code.**

80+ rows across nine groups. Governing principle:

> **Absence of evidence must never render as evidence of absence.**

Each row becomes a test. Input scenario → required behaviour.

---

## 1. Level Handling (model returns various types)

| Input scenario | Required behaviour |
|---------------|-------------------|
| Model returns valid level (1-5) | Stored as integer; `rating_state: "rated"` |
| Model returns `0` | Rejected; stored unrated with reason |
| Model returns `9` | Rejected; stored unrated with reason |
| Model returns `"three"` (string) | Rejected; stored unrated with reason |
| Model returns `null` / nil | Stored unrated; UI shows "not rated"; never L1 |
| Model omits `level` key entirely | Stored unrated; UI shows "not rated" |
| Model returns `1.5` (float) | Rejected; stored unrated with reason |
| Model returns empty string `""` | Rejected; stored unrated with reason |
| Model returns negative `-1` | Rejected; stored unrated with reason |

---

## 2. Confidence Handling

| Input scenario | Required behaviour |
|---------------|-------------------|
| `confidence: "high"` | Normal; verdict asserted |
| `confidence: "medium"` | Normal; verdict asserted with caveat |
| `confidence: "low"` | `insufficient_evidence` verdict; delta shown but not asserted |
| `confidence` absent / nil | Treated as unknown; confidence dot hidden |
| `confidence: "very_high"` (unknown string) | Normalised or rejected; never raises on PG enum |
| `confidence: ""` (empty) | Treated as nil |
| `confidence: 3` (number) | Rejected; stored as nil |

---

## 3. Override Lifecycle

| Input scenario | Required behaviour |
|---------------|-------------------|
| Create override with reason | 201; `assessor_notes` required; `overridden_by` required |
| Create override without reason | 422; UI blocks submission |
| Update existing override | Upserted by portfolio_skill_id; audit event created |
| Regeneration with overrides present | **Overrides survive**; every change an audit event |
| Regeneration on empty transcript | Overrides preserved as stale; non-overridden skills destroyed |
| Override on unrated skill | Allowed; `ai_level` remains nil; `effective_level` = override |
| Override level same as AI level | Allowed; still creates audit event |
| Override by non-assessor role | 403 |

---

## 4. Tenant Isolation

| Input scenario | Required behaviour |
|---------------|-------------------|
| Cross-tenant portfolio ID | **404**, not 403 — do not confirm existence |
| Cross-tenant vacancy ID | **404** |
| Cross-tenant assessment ID | **404** |
| Valid tenant + valid ID | 200 with correct data |
| Unrecognised JWT scheme | 404 (fail-closed) |
| Missing JWT scheme claim | 401 |
| Expired JWT | 401 |

---

## 5. PDF Export

| Input scenario | Required behaviour |
|---------------|-------------------|
| English quotes | PDF renders successfully |
| Indonesian typographic quotes | PDF exports successfully (TTF embedded) |
| 2000-character quote | Clamped with expand; no page overflow |
| 200-character skill label | Clamped with tooltip; no table overflow |
| Unicode characters (emoji, CJK) | PDF exports successfully |
| Empty portfolio (no skills) | PDF renders with "No skills assessed" message |
| Override present | PDF shows override provenance |
| Gemini timeout during narrative | PDF renders with fallback narrative |

---

## 6. Fit/Gap Comparison

| Input scenario | Required behaviour |
|---------------|-------------------|
| Skill in vacancy, absent from portfolio | `not_assessed`; renders "—"; never a gap |
| Skill in vacancy, present but unrated | `not_assessed`; renders "—"; never a gap |
| Skill at same level as vacancy | `match` |
| Skill above vacancy level | `exceed` with positive delta |
| Skill below vacancy level | `gap` with negative delta |
| Skill with low confidence | `insufficient_evidence`; delta shown but not asserted |
| Skill with override | `effective_level` used; `level_source: "assessor"` |
| Vacancy with zero required skills | Empty array; no error |
| Portfolio with zero skills | All vacancy skills show `not_assessed` |

---

## 7. Portfolio Generation

| Input scenario | Required behaviour |
|---------------|-------------------|
| Normal session with candidate turns | `generation_status: "complete"`; skills populated |
| Session with no candidate turns | Skip generation; overrides preserved as stale |
| Gemini timeout | `generation_status: "failed"`; error message stored |
| Gemini malformed JSON | `generation_status: "failed"`; error message stored |
| Gemini empty response | `generation_status: "failed"`; error message stored |
| Duplicate jobs enqueued | Exactly one run; no `RecordNotUnique` |
| Re-run after failure | New attempt overwrites status; existing skills untouched until success |
| Concurrent regeneration | Advisory lock prevents concurrent execution |

---

## 8. WebSocket / Interview

| Input scenario | Required behaviour |
|---------------|-------------------|
| Valid candidate JWT | Connection accepted |
| Invalid JWT | Connection rejected |
| Expired JWT | Connection rejected |
| Connection drop mid-interview | Transcript turns preserved up to drop |
| Reconnection | Session resumes; no duplicate turns |
| Candidate speaks (audio) | Transcribed and stored |
| AI speaks | Audio streamed to candidate |
| Interview time limit reached | Session ends with `end_reason: "time_ceiling"` |

---

## 9. UI States

| Input scenario | Required behaviour |
|---------------|-------------------|
| Portfolio loading | Skeleton spinner shown |
| Portfolio complete | Skills rendered with levels and confidence |
| Portfolio generating | "Generating..." status with progress indication |
| Portfolio failed | Error state with retry option |
| Fit/gap report loading | Skeleton spinner shown |
| Fit/gap report complete | Comparison table + anchor rails rendered |
| Fit/gap narrative unavailable | Banner shown: "AI narrative unavailable" |
| Override panel open | Form with level selector + notes field |
| Override panel submit | Confirmation; audit event created |
| Empty state (no portfolios) | EmptyState component shown |
| Error state (API failure) | ErrorBoundary catches; fallback UI shown |
