# 12 — Screenshot Plan

**Provenance: `[SPEC]`.**

27 screenshots with their fixture data, page paths, and states to capture.

---

## Setup

All screenshots use demo fixtures from `db/seeds/demo.rb`. Run `make api-seed` to populate.

Login as `dev@test-corp.local` (password: `password`).

---

## Portfolio Screenshots

### S1: Portfolio List (Complete State)

- **Path:** `/portfolio`
- **Fixture:** All 7 portfolios
- **State:** Grid showing all portfolio cards with status badges
- **Focus:** Status indicators (complete, generating, failed), candidate names

### S2: Portfolio Detail — Primary (Rina Kartika)

- **Path:** `/portfolio/:id` (portfolio A)
- **Fixture:** Portfolio A with 6 skills
- **State:** Full skill list with levels, confidence, evidence
- **Focus:** Mixed confidence (high/medium/low), discovered skill (Micro-frontend)

### S3: Portfolio Detail — Low Confidence (Budi Santoso)

- **Path:** `/portfolio/:id` (portfolio B)
- **Fixture:** Portfolio B with 2 skills, all low confidence
- **State:** Skills with low confidence indicators
- **Focus:** How low confidence renders differently from high

### S4: Portfolio Detail — Override (Dewi Lestari)

- **Path:** `/portfolio/:id` (portfolio C)
- **Fixture:** Portfolio C with override on React skill
- **State:** Override provenance visible
- **Focus:** Override badge, actor, reason, timestamp

### S5: Portfolio Detail — Empty (Empty Candidate)

- **Path:** `/portfolio/:id` (portfolio F)
- **Fixture:** Portfolio F with zero skills
- **State:** Empty state component
- **Focus:** "No skills assessed" message

### S6: Portfolio Detail — Long Text (Long Text Candidate)

- **Path:** `/portfolio/:id` (portfolio G)
- **Fixture:** Portfolio G with 200-char label, 2000-char quote
- **State:** Expanded evidence quote
- **Focus:** Text clamping, tooltip, no layout overflow

### S7: Portfolio Detail — Failed State

- **Path:** `/portfolio/:id` (portfolio D)
- **Fixture:** Portfolio D with `generation_status: "failed"`
- **State:** Error state with retry option
- **Focus:** Error message, retry button

### S8: Portfolio Detail — Generating State

- **Path:** `/portfolio/:id` (portfolio E)
- **Fixture:** Portfolio E with `generation_status: "generating"`
- **State:** Loading/generating indicator
- **Focus:** Progress indication

---

## Fit/Gap Report Screenshots

### S9: Fit/Gap Report — Primary

- **Path:** `/fitgap/:id` (report for portfolio A vs vacancy)
- **Fixture:** FitGapReport with match, gap, exceed, insufficient_evidence
- **State:** Full comparison table + anchor rails
- **Focus:** All verdict types in one view

### S10: Anchor Rail — High Confidence Match

- **Fixture:** React skill (L3 candidate vs L4 required, high confidence)
- **State:** Precise dot, clear verdict
- **Focus:** Dot size, color, position on rail

### S11: Anchor Rail — Low Confidence Gap

- **Fixture:** REST API skill (L2 candidate vs L3 required, low confidence)
- **State:** Wide uncertainty band, insufficient_evidence verdict
- **Focus:** Band width, opacity, verdict text

### S12: Anchor Rail — Medium Confidence Exceed

- **Fixture:** Node.js skill (L3 candidate vs L2 required, medium confidence)
- **State:** Medium band, exceed verdict
- **Focus:** Band width between high and low

### S13: Fit/Gap Report — Narrative Unavailable Banner

- **Fixture:** Report with `narrative_source: "fallback"`
- **State:** Fallback narrative displayed with banner
- **Focus:** "AI narrative unavailable" banner

### S14: Comparison Table — Override Provenance

- **Fixture:** Skill with `is_override: true`
- **State:** Override indicator in candidate column
- **Focus:** Actor, reason, timestamp

---

## Interview Screenshots

### S15: Interview Page — Active Interview

- **Path:** `/interview/:token`
- **Fixture:** Active session with candidate
- **State:** WebSocket connected, timer running
- **Focus:** Transcript bubbles, voice bars, timer

### S16: Interview Page — Connection Lost

- **Path:** `/interview/:token`
- **Fixture:** Session with dropped connection
- **State:** Reconnection indicator
- **Focus:** Connection status, retry

### S17: Interview Page — Completed

- **Path:** `/interview/:token`
- **Fixture:** Session with `status: "ended"`
- **State:** Completion screen
- **Focus:** End message, no further input

---

## Auth Screenshots

### S18: Login Page

- **Path:** `/login`
- **State:** Empty form
- **Focus:** Email/password fields, login button

### S19: Login Page — Error State

- **Path:** `/login`
- **State:** Invalid credentials
- **Focus:** Error message display

### S20: Login Page — Unresolved Tenant

- **Path:** `/login`
- **State:** JWT with unknown scheme
- **Focus:** "Tenant not found" error (P0-4 fix)

---

## Admin Screenshots

### S21: Assessment List

- **Path:** `/admin/assessments`
- **Fixture:** 2 assessments (en + id)
- **State:** List with language badges
- **Focus:** Language indicator, skill count

### S22: Vacancy List

- **Path:** `/admin/vacancies`
- **Fixture:** 1 vacancy
- **State:** List with role titles
- **Focus:** Required skills count

### S23: Override History

- **Path:** `/audit/overrides`
- **Fixture:** Override events from portfolio C
- **State:** Timeline of override events
- **Focus:** Actor, timestamp, reason

---

## Responsive Screenshots

### S24: Portfolio List — Mobile

- **Path:** `/portfolio` (375px viewport)
- **Fixture:** All 7 portfolios
- **State:** Stacked cards
- **Focus:** Mobile layout, no overflow

### S25: Fit/Gap Report — Tablet

- **Path:** `/fitgap/:id` (768px viewport)
- **Fixture:** Full report
- **State:** Responsive table
- **Focus:** Horizontal scroll, anchor rail adaptation

---

## Dark Mode Screenshots

### S26: Portfolio Detail — Dark Mode

- **Path:** `/portfolio/:id` (portfolio A)
- **Fixture:** Primary portfolio
- **State:** Dark theme enabled
- **Focus:** Verdict tokens, anchor rail, confidence dots in dark mode

### S27: Seeded Faults — Six Failures

- **Path:** Various (test output)
- **Fixture:** Scratch branch with seeded faults
- **State:** Six test failures
- **Focus:** Each failure mapped to the bug it catches
