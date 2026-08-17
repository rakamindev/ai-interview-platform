# Constraint signal

## Constraints implied by code

[VERIFIED-CODE] A portfolio skill must currently carry a numeric 1–5 `ai_level`, non-null confidence, and non-null summary; unknown cannot be persisted.

[VERIFIED-CODE] Fit/gap is vacancy-centric: comparisons iterate vacancy skills and emit `not_assessed` only when no portfolio row exists.

[VERIFIED-CODE] An assessor may override a skill, but generation replaces its children and destroys that override.

## Assumptions not stated as product rules

[HYPOTHESIS] A low-confidence numeric level is intended to be decision-usable; proving this requires an approved definition of confidence and evidence sufficiency.

[HYPOTHESIS] Snapshotting assessment anchors is intended to preserve interview-time rubrics; proving this requires a product-owner decision on historical comparability.

[HYPOTHESIS] A JWT scheme represents the caller’s tenant membership; proving this requires an authoritative membership model.

## Product-owner questions

[HYPOTHESIS] Should a rubric snapshot carry a version and remain attributable when global taxonomy anchors change? A product decision and historical-report expectation would prove the answer.

[HYPOTHESIS] Are `skill_taxonomies` global across tenants or tenant-owned? A tenancy policy and data-ownership decision would prove the answer.

[HYPOTHESIS] Are candidates meant to log in? The current login path rejects non-admin users; an approved candidate journey would prove the answer.

## Needed to proceed confidently

[HYPOTHESIS] A rating-state vocabulary, evidence threshold, rubric-version policy, tenant-membership source, and candidate authentication decision are needed before implementing the schema change.
