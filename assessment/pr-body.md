## Summary

Improves the assessor-facing Fit/Gap Report into a trustworthy decision-support surface for frontend-depth fullstack evaluation.

## What Changed

- Added a deterministic `FitGap::Summary` backend service for readiness score, risk level, recommendation, and review flags.
- Added `required_level` while preserving `expected_level` to fix the backend/frontend comparison contract without breaking older consumers.
- Added override visibility and confidence metadata to skill comparisons.
- Reworked the Fit/Gap Report page into a compact decision dashboard.
- Improved the comparison table with confidence, not-assessed, critical-gap, and override states.
- Added RSpec coverage for the deterministic summary.
- Added assessment documentation PDF and embedded visual evidence.

## Why

The previous report was mostly a raw comparison table. Assessors still had to infer whether a candidate was safe to advance, which skills were unassessed, and which gaps were material. This is risky in a hiring product because candidates are affected by decisions they did not opt into and reviewers need transparent, auditable signals.

## Validation

- `bundle exec rspec spec/services/fit_gap/summary_spec.rb`
- `npm run build`
- Manual local verification on `http://localhost:5173/assessments/1/sessions/1/fitgap/1`
- Seeded fault test: changing critical gap threshold from `delta <= -2` to `delta <= -3` caused the summary spec to fail, then passed again after restoring the correct threshold.

## Notes

- Claimed depth: frontend-depth fullstack slice.
- Final written deliverable: `assessment/final-report.pdf`
