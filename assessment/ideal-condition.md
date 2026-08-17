# Ideal condition: observable rating provenance

[HYPOTHESIS] A correct system displays a numeric level only when the persisted rating has a valid 1–5 value and its supporting evidence is available to the assessor; acceptance is proven by an end-to-end report with the source evidence visible.

[HYPOTHESIS] A malformed, absent, or evidence-free model rating displays `unrated` with a machine-readable reason and never displays L1; acceptance is proven by the parsing scenarios in `acceptance-criteria.md`.

[HYPOTHESIS] A fit/gap report distinguishes candidate level, expected level, rating status, override status, evidence availability, and not-assessed count; acceptance is proven by API and UI assertions.

[HYPOTHESIS] Regeneration preserves an assessor override matched by skill label and reports conflicts rather than silently deleting a human decision; acceptance is proven by a regeneration test.
