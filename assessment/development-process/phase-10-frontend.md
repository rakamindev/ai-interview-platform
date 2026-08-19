# Phase 10 — Frontend changes, explained

The smallest phase so far — one file, `web/src/components/cvScreening/EntryRow.tsx`, one element
changed. No new tool, no new pattern; worth documenting anyway since the convention is every
phase gets an explainer, and the "why" here is more interesting than the diff size suggests.

## What changed

Before:
```tsx
{typeof entry.score === "number" && (
  <span className="text-xs font-medium text-muted-foreground">Score: {entry.score}</span>
)}
```

After:
```tsx
{typeof entry.score === "number" && (
  <Badge variant="secondary">Score: {entry.score}</Badge>
)}
```

The score was already being computed by `DecisionEngine` (Phase 6) and already returned by the
API (Phase 8) — this phase is purely a rendering change. The old version used a plain `<span>`
with the same muted gray text color as everything around it (the filename subtitle, the email),
so it carried no visual weight and was easy to miss scanning down a list. `Badge`
(`web/src/components/ui/badge.tsx`) is one of this app's existing shadcn-style primitives —
already built, just not used anywhere in this component before — a small pill with a background
color and border, the same visual language as a tag or a count indicator. `variant="secondary"`
picks a neutral gray-background style, distinct from the decision-status pills next to it (which
use colored dots + text, not `Badge`, so there's no visual collision between "this is the score"
and "this is the outcome").

Position matters here too: the badge sits first in the row's right-hand cluster, before the
decision-status pill (`Needs review`, `Invited`, etc.) — so the row reads left-to-right as "here's
the score, and here's what it led to," matching how a recruiter actually reasons about a
borderline candidate.

## Why this needed a live browser check, not just a snapshot test

`EntryRow.test.tsx`'s existing 4 cases render entries with `score: undefined` — none of them
exercise the score-badge branch at all, so a passing test suite here doesn't actually prove the
badge looks right. Every entry in the real dev database had `score: null` at the time this phase
was written (a separate, real issue — see the note logged in `IMPLEMENTATION_PLAN.md`'s Phase 10
section about `GEMINI_FLASH_MODEL`/`GEMINI_LIVE_MODEL` possibly not being real model names, which
is why every automated decision has been landing on `model_failed` before ever reaching the
scorer). To actually see the badge, one entry's `score` was set directly via `rails runner`
(`CvScreeningEntry.find(14).update!(score: 62)` — a one-line data fix, not a schema or app-code
change) purely to get a non-null value to look at, then confirmed live in a real browser: a solid,
clearly-bordered "Score: 62" badge ahead of the "Needs review" pill.

## Running it yourself

```bash
cd web
npm run typecheck
npm test
npm run build
```

To see the badge itself, you need at least one entry with a non-null `score` — either fix the
Gemini model names so a real upload scores correctly end to end, or set one directly for a quick
look: `bin/rails runner 'CvScreeningEntry.find(ID).update!(score: 62)'`.
