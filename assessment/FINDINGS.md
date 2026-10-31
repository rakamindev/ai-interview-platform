# Product and implementation findings

Source baseline: `b836d02f45c6300b238b98ad50e66ead706723b6`. Priorities below are this submission's release-risk definitions: P0 blocks release because of unauthorized access; P1 can distort an assessment decision; P2 impairs completion/recovery; P3 is a smaller usability defect. These are not claims of production incidents.

| Priority | Classification | Finding and workflow impact | Disposition |
| --- | --- | --- | --- |
| P0 | Defective implementation | Direct `Portfolio.find` and `PortfolioSkill.joins(:portfolio).find` do not constrain ownership through the session's tenant. A permitted assessor with another portfolio ID can reach another organization's candidate material. | Tenant-scoped lookups for comparison, export, and overrides; bind tenant to authenticated JWT; regression request specs. |
| P1 | Defective implementation | API emits `expected_level`; web reads `required_level`. The recruiter cannot see the level against which a candidate is compared. | Shared integer contract and UI regression assertions. |
| P1 | Defective implementation | `vacancy_skills.index_by(&:skill_label)` collapses repeated labels, and fallback label matching can conflate distinct canonical IDs. Some requirements disappear or use the wrong skill. | One result per requirement; ID-first matching; ambiguous fallback remains unassessed. |
| P1 | Defective implementation / insufficient evidence | The culture/hiring prompt uses skill counts/levels without behavioral evidence. Reviewers can receive a persuasive conclusion unsupported by the supplied input. | Deterministic comparison with explicit separate human review; no culture/hiring prose generated in this slice. |
| P1 | Defective implementation, outside chosen slice | Portfolio generator uses `level.to_i.clamp(1, 5)` and destroys existing skills before all new skills are validated. Invalid AI data can become L1, and a late failure can leave partial replacement data. | Escalate to technical lead; separate strict validation and transactional generation work required. The present change does not claim to fix upstream evidence quality. |
| P2 | Defective implementation | A 404 while polling triggers another generation request. Failed jobs are not represented by durable report state, and regeneration destroys the prior report before replacement. | Comparison no longer depends on a model/queue; on-demand atomic upsert; explicit error/retry. |
| P2 | Missing specification | Ambiguous custom skill identity, missing ratings, and the meaning of confidence after an override have no complete comparison policy. | Define and test conservative matching, null semantics, and separate AI confidence from human provenance. Validate policy with product/domain owners. |
| P2 | Defective implementation | Summary omits unassessed skills, the web type does not match the level payload, and overrides are not serialized into the comparison. Important uncertainty and provenance are hidden. | Explicit coverage, unassessed counts, reasons, rating source, and override indicator. |
| P3 | Defective implementation | The original report has icon-only return navigation, silent request failures, and fixed header/table layouts. Small screens and keyboard users have a harder review flow. | Named navigation, recovery states, wrapping header, stacked mobile rows, visible focus, and large review controls. |

## Product context and domain immersion

The product turns an adaptive interview into a skill portfolio that an assessor can review, amend, and compare with a vacancy. The useful output is a defensible next step for the reviewer: accept the measurement, inspect evidence, or collect missing evidence. A generated paragraph without supporting evidence is not sufficient for that decision.

Assessor: inspect what was measured and explain a correction. Recruiter: identify missing requirements and coordinate follow-up. Hiring manager: interpret proficiency against the role. Candidate: avoid being penalized for a skill that was never assessed and keep interview material within the appropriate organization. These roles are inferred from the brief/wiki, not from conducted user interviews.

For Indonesian deployment, the brief identifies UU PDP as relevant. This implementation addresses a concrete access boundary and avoids real personal data in fixtures/artifacts. Legal basis, notices, retention, rights workflows and provider data transfers require separate product/legal decisions; no blanket compliance certification is claimed.

OPM's primary guidance emphasizes common rating scales and acceptable-answer standards in structured interviews. This supports the choice to make the comparison scale explicit. Its fixed-question method differs from this platform's adaptive PRD, so that method is not imported as a product requirement or presented as Indonesian regulation.

## Constraint signal and follow-up

1. Resolve the yearless 19 August deadline against the hiring portal before submitting.
2. Audit all other tenant/authentication paths before a wider release; fixing this slice is not an application-wide security certification.
   Inaccessible cross-tenant cache rows created by the old implementation are skipped during an authorized override, so they cannot block correction of the candidate's own rating. They remain inaccessible through the protected endpoints; historical derived-cache cleanup is a separate maintenance decision.
3. Upstream portfolio generation can still manufacture a low rating from invalid model data. Correct that before relying on AI output as validated evidence.
4. Confirm missing/ambiguous-skill policy and confidence labeling with assessors and candidate representatives; no usability study or fairness study has been conducted.
5. The local demo uses synthetic portfolios and does not exercise live audio/Gemini interviews. Comparison availability does not depend on those providers.

## Sources consulted

- Supplied four-page case-study brief.
- Baseline repository README, Rails schema/services/controllers, and React report/types/components.
- Product wiki PRD 01 and PRD 02: https://github.com/rakamindev/ai-interview-platform/wiki
- OPM, Structured Interviews: https://www.opm.gov/policy-data-oversight/assessment-and-selection/structured-interviews/
