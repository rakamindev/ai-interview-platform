# Trade-offs

| Option | Product impact | Cost | Maintainability | Failure mode | Reversibility | Contextual fit |
| --- | --- | --- | --- | --- | --- | --- |
| A: keep clamp; force low confidence if evidence empty | [HYPOTHESIS] Reduces false certainty but still asserts L1. | [HYPOTHESIS] ~1 hour. | [HYPOTHESIS] Low. | [HYPOTHESIS] Malformed levels remain false ratings. | [HYPOTHESIS] Easy. | [HYPOTHESIS] Weak. |
| B: nullable `ai_level` plus `rating_status`/`unrated_reason` | [HYPOTHESIS] Preserves uncertainty through the decision flow. | [HYPOTHESIS] ~1 day. | [HYPOTHESIS] Clear state contract. | [HYPOTHESIS] Consumers must handle unrated. | [HYPOTHESIS] Moderate migration rollback. | [HYPOTHESIS] Chosen. |
| C: append-only `skill_ratings` history | [HYPOTHESIS] Adds full audit history. | [HYPOTHESIS] ~3–4 days. | [HYPOTHESIS] Strongest long term. | [HYPOTHESIS] Higher query and migration complexity. | [HYPOTHESIS] Additive. | [HYPOTHESIS] Too large for this pilot. |
| D: fail portfolio for any malformed level | [HYPOTHESIS] Prevents false ratings but discards usable output. | [HYPOTHESIS] ~2 hours. | [HYPOTHESIS] Simple. | [HYPOTHESIS] Operational retries block reports. | [HYPOTHESIS] Easy. | [HYPOTHESIS] Too disruptive. |

[HYPOTHESIS] Option B is the chosen first slice of C; it intentionally forecloses rating history for this pilot, an accepted cost requiring product-owner approval.
