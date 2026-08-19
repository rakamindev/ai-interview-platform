# Phase 4 — Frontend changes

**None this phase.** Phase 4 is entirely backend — see [`phase-4-backend.md`](./phase-4-backend.md) for the full writeup, including a real bug the original plan doc missed and how it got caught.

Nothing about the API's request/response shapes changed. `POST /api/v1/assessments/:assessment_id/sessions` still returns the same `session`/`invite_url` shape it always did — the invite URL's *value* now correctly points at the frontend host (`WEB_BASE_URL`) instead of the backend, but the field itself is unchanged, so no frontend code needs to change to pick that up.

This file exists anyway, per the project's documentation convention (see `assessment/explainers/README.md`).
