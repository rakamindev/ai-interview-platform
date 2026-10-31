# Evidence-first Fit/Gap review

Baseline: `b836d02f45c6300b238b98ad50e66ead706723b6`.

## Problem and scope

The web app reads `required_level` but the API emits `expected_level`. Missing skills disappear from the summary, human overrides lose their provenance, and portfolio lookups do not constrain access by tenant. The culture prompt asks for personality and hiring conclusions from skill-level differences, without behavioral evidence for those conclusions.

Deliver an explainable, tenant-isolated Fit/Gap report. Follow the existing light interface, teal identity, system typography, and Radix controls. The report's main decision is which skill needs follow-up. ENERGY 1 / RHYTHM 2 / MOTION 1. Teal identifies primary actions; semantic result colors carry state; borders group related information. Retain existing icons only for recognizable actions. No new decorative assets.

## Acceptance criteria, written before implementation

1. Required and candidate levels use the same integer L1-L5 contract in API, web, and export.
2. Each vacancy requirement produces one row. Duplicate labels cannot discard requirements.
3. Missing skills or invalid/missing ratings are `not_assessed`, with null candidate level and delta. Never coerce them to zero or L1.
4. Match canonical IDs first. Different IDs must not merge because their labels match. Label fallback is case/whitespace normalized, allowed only if an ID is absent; ambiguous matches stay unassessed.
5. An assessor override wins over the AI level and is explicitly identified. AI confidence remains visible and is not a verification claim.
6. Summary counts matches, exceeds, gaps, and unassessed skills separately. It is not a hiring recommendation or candidate score.
7. Tenant A cannot read, export, regenerate, compare, or override Tenant B's portfolio. Legacy jobs cannot compare records from different tenants.
8. Fresh reads reflect changed overrides and vacancy requirements. Failed recomputes preserve the previous report.
9. Repeated/concurrent generation has one report per portfolio/vacancy. No model request or queue is needed for arithmetic; duplicate legacy jobs are harmless.
10. UI handles accessible loading, error/retry, empty, partial, long-text, responsive, and export-error states. Failed requests cannot cause endless requeueing.
11. Culture fit and hiring decisions require separate human review. Do not infer them from skill arithmetic.
12. Tests detect a deliberately seeded wrong comparison; the fault and revert remain in Git history.

## Options and decision

| Option | Value / cost | Failure and maintenance trade-off |
| --- | --- | --- |
| A. Rename frontend field | Very low cost; required levels become visible | Leaves tenant leaks, lost provenance, unsafe matching, queue loops, and unsupported prose |
| B. Deterministic comparison and human review (chosen) | Fast, explainable, testable report without AI/network dependencies | Automated culture prose is removed; behaviorally grounded culture review is deferred |
| C. Durable asynchronous AI pipeline | Preserves AI prose with status/lease/retry tracking | Additional schema, queue coordination, provider handling, and evidence grounding are needed before prose is useful |

Choose B for this small comparison workload. Keep the worker entry point for compatibility, but remove queueing from interactive Fit/Gap and override requests. Use the existing unique index and portfolio row lock for atomic upserts. No schema migration is necessary: JSONB holds richer rows. Retain narrative columns for a reversible rollout, replacing their contents on recompute.

## Constraints and assumptions

- The PDF deadline has no year; reconcile it with the hiring portal.
- Local Windows initially has Node, but no Ruby/PostgreSQL/Redis/Docker on PATH. Record actual setup and test evidence.
- Wiki filenames include colons that Windows cannot check out; read Git blobs into safe local filenames.
- Persona observations come from the brief/wiki, not interviews with actual users.
- Use synthetic fixtures; exclude credentials, tokens, real transcripts and personal data from artifacts.
- Portfolio AI coercion and interview transport remain separate findings, not claimed fixes.
