# Phase 5 — Frontend changes

**None this phase.** Phase 5 is entirely backend — see [`phase-5-backend.md`](./phase-5-backend.md) for the full writeup.

The CV screening API now exists (create a screening, upload a batch of CVs, list/review entries, download a file), but there's no UI for any of it yet — that's Phase 8. If you want to see the shape of what the frontend will eventually call, the routes are:

```
POST   /api/v1/cv_screenings
GET    /api/v1/cv_screenings
GET    /api/v1/cv_screenings/:id
PATCH  /api/v1/cv_screenings/:id
POST   /api/v1/cv_screenings/:id/batches       (multipart — files[])
GET    /api/v1/cv_screenings/:id/entries
POST   /api/v1/cv_screening_entries/:id/review  { action: 'invite' | 'reject' }
GET    /api/v1/cv_screening_entries/:id/file
```

Worth flagging now, since it'll matter directly for Phase 8: the batch-upload endpoint is a genuinely new pattern for this codebase — it's the *first* file-upload endpoint anywhere in the app. `src/services/api.ts` currently sets a global `Content-Type: application/json` header on every request, which a `multipart/form-data` upload needs to override (or omit) so the browser can set its own boundary. That'll be Phase 8's problem to solve, not this one.

This file exists anyway, per the project's documentation convention (see `assessment/explainers/README.md`).
