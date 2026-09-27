# 05-dual-mode-taxonomy-and-fitgap-contract

Status: completed
Blocked by: none

## Context
1. `SkillPicker.tsx:41` strips `skill_id` to `undefined`, saving `NULL` in the database.
2. `FitGap::Engine` emits `expected_level` while `ComparisonTable.tsx` expects `required_level` and `is_override`, rendering the "Required" column completely blank and hiding override badges.
3. Fit/Gap narrative generation receives bare integer numbers without candidate evidence quotes, causing hallucinations.
4. Capitalized confidence strings from Gemini (`"High"`) cause PostgreSQL enum crashes.

## Implementation Details
1. Update `web/src/components/assessment/SkillPicker.tsx:41`:
   - Retain `skill_id: s.skill_id` when selecting from the B7 taxonomy.
2. Update `api/app/services/fit_gap/engine.rb`:
   - In `build_skill_comparisons`, return both `required_level: expected_level` and `expected_level: expected_level`.
   - Include `is_override: portfolio_skill&.dig(:overridden) || false`.
   - Include discovered skills in the comparison list with exceed status.
   - In `build_narrative_prompt`, pass the candidate's top 2 verbatim evidence quotes and competency summaries from `portfolio_skills`.
3. In `api/app/services/portfolios/generator.rb:162, 174`:
   - Normalize `skill_data['confidence']` via `.to_s.downcase.strip` before creating `portfolio_skills`.
4. Update/run tests in:
   - `web/src/test/components/fitgap/ComparisonTable.test.tsx`
   - `web/src/test/components/assessment/SkillPicker.test.tsx`
   - `api/spec/services/fit_gap/engine_spec.rb`

## Verification
- `cd web && npm test src/test/components/fitgap/ComparisonTable.test.tsx`
- `cd web && npm test src/test/components/assessment/SkillPicker.test.tsx`
- `cd api && bundle exec rspec spec/services/fit_gap/`
