# Acceptance criteria

## Parsing

[HYPOTHESIS] Given level `""`, `"foo"`, or `"L3"`, when a portfolio is generated, then the skill is `unrated` with reason `malformed` and is never L1.

[HYPOTHESIS] Given `evidence=[]`, when a rating is persisted, then it is `unrated` with reason `no_evidence`.

[HYPOTHESIS] Given confidence `high`, when the rating is accepted, then it has at least two evidence quotes.

[HYPOTHESIS] Given temperature configuration for portfolio generation, when scoring executes, then temperature is `0`.

## Persistence

[HYPOTHESIS] Given zero valid skills, when generation finishes, then `generation_status` is `failed`.

[HYPOTHESIS] Given regeneration and an existing override with the same `skill_label`, when skills are replaced, then the override is preserved.

[HYPOTHESIS] Given an unrated skill, when an assessor provides an override, then the override is accepted and becomes the effective level.

## Fit/gap

[HYPOTHESIS] Given a vacancy skill without a portfolio row, when fit/gap is generated, then it remains `not_assessed`.

[HYPOTHESIS] Given a comparison, when the API serializes it, then it includes `expected_level`, `is_override`, and `rating_status`.

[HYPOTHESIS] Given a partial report, when it renders, then it shows how many skills were not assessed.

## Frontend

[HYPOTHESIS] Given a comparison response with `expected_level`, when the table renders, then the Required column reads that field.

[HYPOTHESIS] Given an unrated comparison, when the table renders, then it presents its reason and does not present a numeric candidate level as evidence.
