# Findings

Evidence labels identify the basis of each finding; line references are source locations read for this assessment.

## F1 — P0: malformed level is asserted as L1

[VERIFIED-CODE] `api/app/services/portfolios/generator.rb:161,173` writes `skill_data['level'].to_i.clamp(1, 5)` for configured and discovered skills; unexpected strings and empty values therefore become 1.

[VERIFIED-RUNTIME] `ruby -e 'p ["", "foo", "L3", nil.to_s].map { |s| s.to_i.clamp(1,5) }'` returned `[1, 1, 1, 1]`; raw output is in `evidence/ruby-clamp.txt`.

[VERIFIED-CODE] `portfolio_skills.ai_level` is non-null and constrained to 1–5 in `api/db/schema.rb`, so the persistence model cannot represent an unknown rating.

[VERIFIED-CODE] This harms candidates because taxonomy L1 is a positive competency claim, not an unknown state; fix by making rating state explicit rather than coercing malformed input.

## F2 — P0: the uncertainty vocabulary already exists but persistence cannot use it

[VERIFIED-RUNTIME] The supplied fit/gap report records a vacancy skill without a portfolio row as `{result:"not_assessed", candidate_level:null, delta:null}` in `evidence/fitgap-report-before.json`.

[VERIFIED-RUNTIME] The same report records Node.js as `{result:"gap", candidate_level:1, confidence:"high"}` after an unparseable level was persisted as L1.

[VERIFIED-CODE] `api/app/services/fit_gap/engine.rb:51-55` emits `not_assessed` when no portfolio skill exists, while `:46-50` compares any persisted level.

[VERIFIED-CODE] This is a consistency fix: API comparison, table result state, and portfolio UI already express uncertainty; a nullable/explicitly unrated portfolio skill is the missing link.

## F3 — P0: regeneration destroys assessor overrides

[VERIFIED-CODE] `api/app/services/portfolios/generator.rb:153-154` destroys all portfolio skills before recreating them, and the portfolio skill relationship destroys its `has_one :assessor_override` dependent record.

[VERIFIED-CODE] `api/db/schema.rb` has no unique index on `(portfolio_id, skill_label)`, so preservation cannot be inferred from a stable database identity.

[VERIFIED-CODE] This harms assessors because a deliberate human correction disappears during regeneration; match existing overrides by `skill_label` during replacement.

## F4 — P0: login signs a client-selected tenant claim

[VERIFIED-CODE] `api/app/controllers/api/v1/authentication_controller.rb:24-29` prefers `X-Tenant-Scheme` and `:17` signs that scheme in the JWT.

[VERIFIED-RUNTIME] The established login observations decoded otherwise identical credentials into claims for `test-corp` and `some-other-company`; the supplied payloads are recorded in `evidence/login-tenant-claims.txt`.

[VERIFIED-CODE] `users` has no tenant column, while assessments, vacancies, and sessions do; membership is therefore not authoritatively represented by the user record.

[VERIFIED-CODE] This harms tenant isolation; bind authentication to an authoritative user-to-tenant membership before issuing a claim.

## F5 — P1: the fit/gap response and table disagree and discard provenance

[VERIFIED-CODE] `api/app/services/fit_gap/engine.rb:58-66` serializes `expected_level` and omits its computed `overridden` value from `:73-84`.

[VERIFIED-CODE] `web/src/components/fitgap/ComparisonTable.tsx:50,56` reads `required_level` and `is_override`.

[VERIFIED-RUNTIME] The Required column was blank for every established report row, and the override legend rendered despite `AssessorOverride.count` being zero.

[VERIFIED-RUNTIME] The established fit/gap page carries neither evidence, competency summary, nor override provenance, although the Portfolio Results page displays all three.

[VERIFIED-CODE] This harms hiring decisions because the decision screen reduces a rating to a label and result; carry the canonical field names and provenance into the contract.

## F6 — P1: not-assessed and discovered skills are excluded from the decision summary

[VERIFIED-CODE] `web/src/components/fitgap/ComparisonTable.tsx:29-31,73-76` counts only match, gap, and exceed, then always renders the override legend.

[VERIFIED-RUNTIME] The established narrative totals four assessed results while the report contains five rows including `not_assessed`.

[VERIFIED-RUNTIME] Kubernetes Operations, a discovered skill, is absent from `skill_comparisons`, the footer counts, the narrative, and the JSON export, while rendering separately on screen from a second portfolio fetch; the screen reduces it to `3 (low confidence)`, dropping the level label, confidence colour, evidence quote, and low-confidence caveat banner that the Portfolio Results page shows for the same skill.

[VERIFIED-CODE] `api/app/services/fit_gap/engine.rb:39-43` iterates vacancy skills, explaining why discovered-only skills are not compared.

[VERIFIED-CODE] This harms assessors because missing evidence looks like a complete decision; explicitly count `not_assessed` and show discovered skills as contextual evidence.

## F7 — P1: rubric snapshots have no version or owner

[VERIFIED-CODE] `assessment_skills` copies labels, five anchors, and expected level; `vacancy_skills` independently stores labels and expected level; the schema defines no rubric version.

[VERIFIED-CODE] `api/app/services/fit_gap/engine.rb:40,48` uses vacancy expected level, not the assessment snapshot.

[HYPOTHESIS] Snapshotting may be intentional, but without a version marker an anchor correction cannot be associated with historical ratings; proving intended behavior requires a product-owner decision on rubric versioning.

## F8 — P2: fit/gap generation has no observable state

[VERIFIED-RUNTIME] The established POST response says `generating`, while a subsequent GET can return `404 Fit/gap report not found`; the schema has no report status column.

[VERIFIED-CODE] `fit_gap_reports` therefore cannot itself encode queued, failed, or never-requested states.

[VERIFIED-CODE] This harms assessors because waiting and failure are indistinguishable; add an observable generation state and error reason.

## F9 — P2: role vocabulary is internally inconsistent

[VERIFIED-RUNTIME] `User.validators_on(:role)` allowed `admin` and `user`, and creating `assessor` was rejected.

[VERIFIED-CODE] Six controllers authorize `:assessor`, `api/app/controllers/application_controller.rb:12` allows admin or assessor, and the login controller accepts only `admin`.

[VERIFIED-CODE] This harms access-control maintenance because one actor has three names; define one canonical role vocabulary and migration path.

## F10 — P2: coverage is not evidence of a completed live interview

[VERIFIED-RUNTIME] The established coverage response for completed session 1 was `{skills:[], discovered:[], updated_at:null}`.

[VERIFIED-CODE] `api/app/controllers/api/v1/sessions_controller.rb:80-89` reads live `coverage_maps`; it does not reconstruct coverage from a portfolio.

[HYPOTHESIS] This is not a defect if coverage maps are written only during the live loop; a real interview or live-loop trace would prove or disprove the operational expectation.

## F11 — P2: onboarding cannot be reproduced from shipped defaults

[VERIFIED-RUNTIME] The established clean-clone observation found `web/.env.example` pointing to port 3000 while the API serves 3001.

[VERIFIED-CODE] The frontend is `web/`, while the README references `../ai-interview-web`; `api/config/puma.rb` enables development workers requiring the documented single-process macOS workaround.

[VERIFIED-CODE] This harms evaluators because a fresh clone cannot follow a single reliable path; align checked-in defaults and README with the supported local configuration.

## F12 — P3: minor text and configuration debt reduces auditability

[VERIFIED-CODE] Skill taxonomy anchors contain missing spaces, and `api/app/services/fit_gap/engine.rb` reads `GEMINI_FLASH_MODEL` not documented in `api/README.md`.

[VERIFIED-CODE] These do not change a current rating but make the rubric and its operational dependencies harder to review; correct copy and document active environment variables.
