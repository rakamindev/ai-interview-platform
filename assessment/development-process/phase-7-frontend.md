# Phase 7 — Frontend changes

**None this phase.** Phase 7 is entirely backend — see [`phase-7-backend.md`](./phase-7-backend.md) for the full writeup.

One new endpoint worth knowing about for Phase 8: `POST /api/v1/cv_screenings/:cv_screening_id/batches/:id/confirm`, which releases a batch's held notification emails (FR5's "mass-batch confirm gate" — see the backend doc). The batch JSON response now also includes a `notification_status` field (`pending` / `held` / `released`) — Phase 8's UI will need this to show a recruiter when a batch is waiting on their explicit confirmation before any emails go out.

This file exists anyway, per the project's documentation convention (see `assessment/explainers/README.md`).
