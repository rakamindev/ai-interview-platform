# Assessment: skill-rating provenance

This assessment investigates the portfolio rating persistence path, fit/gap report contract, and assessor-facing provenance; source locations are cited in [findings.md](findings.md).

[VERIFIED-CODE] Thesis: `String#to_i.clamp(1, 5)` in `api/app/services/portfolios/generator.rb:161,173` can persist malformed model levels as L1.

> A score without provenance is a guess dressed as a fact.

| Severity | Finding | Label |
| --- | --- | --- |
| P0 | Malformed rating becomes positive L1 | [VERIFIED-CODE] |
| P0 | Regeneration deletes human overrides | [VERIFIED-CODE] |
| P0 | Client selects the signed tenant scheme | [VERIFIED-RUNTIME] |
| P1 | Fit/gap loses required level and provenance | [VERIFIED-RUNTIME] |
| P1 | Rubric snapshots have no version marker | [VERIFIED-CODE] |
| P2 | Report generation has no observable lifecycle | [VERIFIED-RUNTIME] |

Start with the persistence constraint in F1, then the existing `not_assessed` vocabulary in F2; together they make this a consistency fix rather than a new feature.

The proposed implementation slice is Option B in [trade-offs.md](trade-offs.md); acceptance checks are in [acceptance-criteria.md](acceptance-criteria.md).
