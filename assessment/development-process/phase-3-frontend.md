# Phase 3 — Frontend changes

**None this phase.** Phase 3 is a small backend-only retrofit — see [`phase-3-backend.md`](./phase-3-backend.md) for the full writeup.

`fit_gap_reports` now internally track which `VacancyVersion` they were generated against, but that field isn't exposed in the API response (`fit_gap_json` in `portfolios_controller.rb` is unchanged) and the existing Fit/Gap UI (`src/components/fitgap/ComparisonTable.tsx`) doesn't need to change to keep working correctly — nothing about what it already displays was wrong. This is purely a data-integrity fix sitting underneath the existing feature, not a new capability.

This file exists anyway, per the project's documentation convention (see `assessment/explainers/README.md`).
