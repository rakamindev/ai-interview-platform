# Phase 6 — Frontend changes

**None this phase.** Phase 6 is entirely backend — see [`phase-6-backend.md`](./phase-6-backend.md) for the full writeup.

Entries uploaded in Phase 5 now actually get processed in the background and land on a real `decision`, but nothing about the API's response shapes changed — `GET /cv_screenings/:id/entries` already returned `decision`/`decision_reason`, they just always said `pending` before. The frontend (Phase 8) will read the exact same fields; it just wasn't built yet to poll and display them changing over time.

This file exists anyway, per the project's documentation convention (see `assessment/explainers/README.md`).
