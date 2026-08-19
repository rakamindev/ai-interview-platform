# 04 — Implementation Log

## Backend Fixes (Scoped & Real)
I began by addressing the critical flaw where unassessed skills were silently penalized with an L1 rating. This required a full-stack adjustment starting at the data layer.

1.  **Database Migration**: Created `20260818000001_allow_null_ai_level_on_portfolio_skills.rb`. I replaced the `NOT NULL` constraint on `portfolio_skills.ai_level` with one that permits `NULL`, while retaining the `1-5` validation when present. I made it safely reversible by checking for existing `NULL` values in the `down` method to prevent data corruption upon rollback.
2.  **Model & Generator**: Updated `PortfolioSkill` to `allow_nil: true`. In `Portfolios::Generator`, I modified the LLM prompt to explicitly return `null` when a skill wasn't discussed. The `save_skills` method now preserves this `null` instead of running `.to_i.clamp(1, 5)`. This stops the fabrication of scores.
3.  **Engine & Exports**: I updated `FitGap::Engine` to handle `nil` levels gracefully, assigning them a `not_assessed` result instead of crashing. `PdfGenerator` was also updated to display 'Not Assessed' instead of a blank string.
4.  **Test Harness**: Set up a minimal RSpec configuration (`spec_helper.rb`, `rails_helper.rb`) and wrote tests for `Portfolios::Generator` and `FitGap::Engine` to ensure the `null` level handling works as expected.

## Frontend Improvements (Depth Center)
The frontend required multiple updates to cleanly render unassessed states without confusing users.

1.  **Vitest & React Testing Library**: Initialized the testing environment (`vite.config.ts`, `setup.ts`) to enable UI testing.
2.  **`SkillPortfolioCard` Revamp**: 
    -   Added an explicit "Unassessed Note" that explains to users *why* the skill wasn't scored, preventing confusion.
    -   Implemented `ExpandableText` and `ExpandableList` to handle extremely long competency summaries and evidence lists (truncating at 3 lines or items) with "Show more" toggles.
3.  **Component Upgrades**:
    -   `LevelBadge.tsx`: Now renders an "N/A" badge with `bg-neutral-100 text-neutral-500` styling when `level === null`.
    -   `ConfidenceIndicator.tsx`: Now displays "Confidence: N/A" if confidence is null/undefined.
    -   `OverridePanel.tsx`: Fixed state initialization to correctly handle overriding a skill from a `null` baseline (defaults to 1 if overridden).
    -   `constants.ts`: Updated `parseLevel` to explicitly allow and return `null`.
4.  **Error States**: Added `fetchError` handling to `PortfolioPage.tsx` to prevent a broken empty page if the portfolio API call fails.
5.  **Tests Written**: Wrote `SkillPortfolioCard.test.tsx` which successfully verifies the standard render, the unassessed warning render, and text truncation behavior.
