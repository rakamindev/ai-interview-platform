# Product context and evidence boundaries

## What this product is for

The product specification describes an AI-led skills interview followed by a portfolio and a rule-based comparison to a vacancy. The review step must help an assessor inspect evidence and decide what to probe next. It is decision support; a skill-level delta does not establish a hiring verdict or culture fit.

Sources inspected on 25 October 2026:

- [PRD 01: interview behavior](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-01-%E2%80%94-First-Principles:-AI-Interview-Behavior): behavior anchors, probing, evidence and confidence.
- [PRD 02: end-to-end simulation](https://github.com/rakamindev/ai-interview-platform/wiki/PRD-02-%E2%80%94-Real-Simulation:-End%E2%80%90to%E2%80%90End-Interview): phase 5 specifies required vs candidate levels, match/gap/exceed, and review/export.
- [Kemnaker Pasker ID](https://paskerid.kemnaker.go.id/): official Indonesian labor-market and vacancy information. It provides market context, not evidence that this specific product saves time or improves hiring accuracy.
- [UU 27/2022, official Komdigi text](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/crc32/): personal-data rights and controller obligations. Relevant design considerations include correction and access rights, objections to solely automated decisions with significant effects, accuracy, security, and accountability. This project does not establish organization-wide legal compliance.

## User hypotheses and consequences

| Person | Job to do | Consequence of the baseline issue | Improvement |
| --- | --- | --- | --- |
| Assessor | Verify a level against interview evidence and revise it | AI vs human source is obscured in downstream comparison | Show provenance and original AI level |
| Recruiter | See whether observed skills meet role requirements | Required level disappears due to API/UI field mismatch | One typed contract and explicit benchmark |
| Hiring manager | Decide what follow-up is needed | Missing evidence can disappear from summary | Count unassessed separately and recommend follow-up |
| Candidate | Receive an evidence-based, correctable assessment | Unsupported ratings or cross-tenant disclosure can materially harm them | Preserve unknowns, protect tenant boundaries, expose human review |

These are hypotheses derived from the workflow and brief, not claims from user interviews. No quantified business benefit or fairness metric has been measured.

## Industry interpretation

Vacancy posting and generic generated summaries are widely available capabilities. The opportunity selected here is reliable evidence handling at the point a recruiter acts: what was assessed, against which requirement, how certain the original rating was, and whether a human changed it. This is a product judgment, not a market-share finding. Indonesia's language and access diversity make readable narrow-screen layouts and careful treatment of incomplete interviews relevant. No demographic attributes are used to score or rank candidates.

## Deliberate departure from the baseline narrative

PRD 02 includes an AI culture narrative. The current engine's narrative prompt uses comparison labels and levels rather than grounded behavioral evidence and asks for a hiring recommendation. This change replaces that specific narrative with a reproducible comparison summary and an explicit human-review note. It retains the skill-comparison workflow while avoiding unsupported culture judgments and an unnecessary external model dependency. Behavioral narrative generation could return later with quote-level grounding, separate consent/data-processing review, and a quality evaluation set.

## Privacy implementation scope

Synthetic fixtures only. Report, override, and export access is checked through the owning session's tenant; a vacancy must belong to the same tenant. Errors store safe codes rather than provider responses, transcripts, or exception messages. The deterministic fit/gap service sends no candidate data to an AI provider. This does not address the entire existing interview system's data retention, deletion/access request handling, provider contracts, or candidate notice/consent. Those remain explicit technical-lead follow-ups.
