# Design direction: assessor app

Derived from what the app already ships (tokens in `src/index.css`), not invented.
Applies to the signed-in assessor screens. The candidate interview screen keeps its own calm, single-task layout.

## Who and what
- Users: recruiters and hiring managers reviewing one candidate at a time, mostly on a laptop, sometimes on a phone between meetings.
- The decision: "Is the AI rating trustworthy, and does this candidate fit this vacancy?" Every screen is built around that decision.
- Tone: a working tool. Calm, factual, precise. No marketing voice.

Dial: ENERGY 1 / RHYTHM 2 / MOTION 2

## Palette (2 core + 1 accent + neutrals)
- Teal (`--primary`): Rakamin brand `#01959f`, shipped as `#01767f` so white button text and teal-on-tint text pass WCAG AA (Lighthouse flagged the original at 3.7:1). Primary actions, current nav item, focus ring.
- Slate neutrals (`--foreground`, `--muted*`, `--border`): text and surfaces.
- Yellow `#FBC037` (`--secondary`): brand accent, used sparingly.
- Status colors carry meaning only: green = meets the requirement, amber = gap or needs attention, red = failure, grey = not assessed. Never decorative.

## Type
- System sans stack (Tailwind default). Reason: an internal tool should load instantly and read like the OS; identity comes from the teal and the level badges, not a display font.
- Sentence case for labels and headings. No uppercase-with-tracking labels.

## Identity motif
- The level badge (L1 to L5, colored by level). It appears wherever a rating appears: portfolio, override, fit/gap. Ratings always read as a badge, never as loose text.
- Human decisions are marked the same way everywhere: a pencil icon plus "Assessor override".

## Rules for screens
- One focal point per screen: on the portfolio, the skill ratings; on fit/gap, the verdict summary and the comparison.
- Every data view ships loading, empty, error, and partial states that say what happened and what to do next.
- Shadows: one level only. Cards get a border plus the small default shadow to separate them from the page; larger elevation is for popovers and dialogs.
- Motion (`motion` library, loaded lazily, off for users who ask for reduced motion). Each use answers "what changed?":
  - nav indicator slides to the section you opened;
  - index rows arrive top to bottom once data loads;
  - the override form and vacancy skill rows expand and collapse in place, so content below moves instead of jumping;
  - errors, warnings and confirmations fade in so they are noticed.
  No loops except a spinner while something is actually running.
- Phone: no horizontal scroll at 390px, 44px tap targets, tables become stacked cards.
