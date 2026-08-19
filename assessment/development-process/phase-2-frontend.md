# Phase 2 — Frontend changes

**None this phase.** Every change in Phase 2 is backend-only — new database tables, a model callback, a backfill script, and one controller field. See [`phase-2-backend.md`](./phase-2-backend.md) for the full writeup.

Nothing this phase is visible in the UI yet, and that's intentional, not an oversight: Phase 2 only builds the *storage* for version snapshots (`vacancy_versions`/`assessment_versions`) — it doesn't wire anything to read from them. The consumers that will actually use this data are:

- **Phase 3** — Fit/Gap reports start pointing at a frozen vacancy version instead of the live, editable one.
- **Phase 4** — interview sessions start reading the assessment skills that existed *at invite time*, fixing the actual bug this mechanism exists for (see "What this phase is actually solving" in the backend doc).
- **Phase 8** — the one bit of this that eventually reaches the UI: a small badge on pre-migration records noting they got an *approximate*, not fully historical, snapshot (since the backfill task in Phase 2 can only reconstruct a version from a record's *current* state, not its actual history before this feature existed).

This file exists anyway, per the project's documentation convention (see `assessment/explainers/README.md`) — a phase with no frontend work still gets a doc, explicitly saying so, rather than being silently skipped.
