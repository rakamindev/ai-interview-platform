# Options, trade-offs, and acceptance criteria

## Options

| | Option A (shipped) | Option B (rejected) | Option C (supporting only) |
|---|--------------------|---------------------|----------------------------|
| **What** | Harden the portfolio / override / fit-gap contract and decision UX | Rebuild scoring / comparison algorithm | Visual polish only |
| **Product** | Directly changes what an assessor trusts before a hire | High, but wrong scores are worse than honest gaps | Low impact vs the brief |
| **Cost** | Fits a fullstack slice + tests | Slip risk on this deadline | Cheap, fails the rubric |
| **Walk-back** | Extends existing models/controllers | Hard to unwind | Easy and shallow |
| **Failure modes** | Model timeout, empty transcript, Redis down — handled as failed/retry | Silent mis-score | Ignores model failure |

**Choice:** Option A. Option B is a follow-up. Option C is polish on top of A (shared layout, list search, empty/error states) — not the hero by itself.

Rejected / deferred on purpose: invite email, enterprise CI, server-side search, Gemini Live rewrite, new tenant platform, bundled Unicode TTF for PDF (transcode to Win1252 instead).

## What shipped (fullstack)

| Seam | Change |
|------|--------|
| API | Gemini HTTP `v1` → `v1beta`; fit-gap emits `required_level` + `is_override`; regenerate only from `failed`; export/fit-gap refused until complete; PDF text transcoded for Prawn/Win1252 |
| Web | Portfolio generating / failed / empty / complete; export & fit-gap gated; override vs AI visible; fit-gap `not_assessed`; candidate interrupted + recovery invite |
| Data | No migration. Existing enums/statuses. Custom vacancy skills stay `skill_id: null` by design |
| Adjacent | Prefill assessment from vacancy; hardware-check retry; list search/filter + overflow |

## Acceptance criteria — API

| ID | Criterion | Status |
|----|-----------|--------|
| A1 | `GET …/portfolio` distinguishable for generating / complete / failed | Done for those three. Nil row still 202 generating (documented assumption) |
| A2 | Failed includes `generation_error` (FE also sanitizes secrets) | Done |
| A3 | Regenerate only from `failed`; second click while pending rejected | Done |
| A4 | Complete returns skill list (weak evidence is a FE concern) | Done |
| A5 | Missing assessor token → 401 | Done (request spec) |
| A6 | Cross-tenant leak | Not newly tested; existing tenant middleware. Called out as constraint |
| A7 | Override level 1–5 + audit `overridden_by` | Done. Notes have no max length (long text allowed) |
| A8 | Fit-gap `match` / `gap` / `exceed` / `not_assessed` | Done |
| A9 | Fit-gap enqueue returns poll-friendly `generating` | Done |
| A10 | Export refused when not complete | Done |
| A11 | PDF export succeeds when complete, including override + Gemini UTF-8 | Done (`Exports::PdfGenerator#pdf_safe`; glyphs outside Win1252 become `?`) |

## Acceptance criteria — Web

| ID | Criterion | Status |
|----|-----------|--------|
| W1–W4 | Loading / empty / generating / failed + retry | Done on portfolio |
| W5–W7 | Configured vs discovered, confidence/override, long text | Done at card/page level |
| W8 | `not_assessed` + override flag on comparison | Done |
| W9 | Usable ~375px and desktop | Done in polish pass (`max-w-4xl`, wrap, mobile nav) |
| W10 | Typed portfolio mapping (no `as any` on that seam) | Done via `portfolioStatus.ts` |

## Tests (T1–T4)

| ID | Criterion | Status |
|----|-----------|--------|
| T1 | RSpec that fails if portfolio/fit-gap/override regresses | Done (`bundle exec rspec`) |
| T2 | Web runner + meaningful mapping/UI tests | Done (`npm test`) |
| T3 | Seeded fault on a scratch branch | Procedure in `03-test-harness.md` — capture RED/GREEN before portal PDF |
| T4 | AI verification | `04-ai-verification.md` |
