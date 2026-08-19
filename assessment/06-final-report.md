# Raka - Take-Home Assessment Submission

## Overview
This submission tackles a fundamental product and data integrity gap within the AI assessment platform. I discovered that when the AI fails to assess a configured skill (often due to time limits in the interview), the system silently clamps the missing score to a Level 1 (`L1`) by default, rather than treating it as "Unassessed."

From a product perspective, particularly under Indonesia's UU PDP (Personal Data Protection Law) concerning data accuracy, fabricating a low score for a candidate without evidence is a critical flaw that unfairly penalizes them. 

This pull request resolves this issue comprehensively across the entire stack, prioritizing clarity in the frontend experience while safeguarding data logic in the backend.

## Deliverables Directory
The accompanying documents detail my engineering thought process:

1.  **`01-context.md`**: Evaluation of the product's persona, context, and legal/ethical implications (UU PDP).
2.  **`02-findings.md`**: A severity-tagged breakdown (P0-P3) of the identified product gaps, including the primary unassessed-skills flaw.
3.  **`03-strategy.md`**: Architectural comparison (Option A vs Option B) for the fix, cementing the decision to handle nulls gracefully.
4.  **`04-implementation-log.md`**: A chronological record of the implementation phase across the backend (Ruby on Rails) and frontend (React/Vite).
5.  **`05-verification.md`**: Verification checklist to prove the implementation handles edge cases without regressing.

## Technical Implementation Highlights

### Backend (Rails & PostgreSQL)
-   **Safe Database Migration**: Relaxed the `NOT NULL` constraint on `portfolio_skills.ai_level` to allow `NULL`, while retaining the `1-5` range check for valid values. Reversible via a strict safety check in the `down` migration.
-   **LLM Generator Update**: Updated `Portfolios::Generator` instructions to explicitly demand a `null` output when a skill is completely missing from discussion, preventing the `.to_i.clamp(1, 5)` bug from fabricating data.
-   **Graceful Degradation in Services**: Ensured `FitGap::Engine`, `PdfGenerator`, and `AssessorOverride` correctly identify and label `nil` as 'Not Assessed'.
-   **Testing Foundation**: Implemented a core RSpec harness for unit testing the generator logic and FitGap math.

### Frontend (React, Radix, Tailwind)
-   **Test Runner Setup**: Integrated `vitest` and `@testing-library/react` to enable robust component testing.
-   **Explicit UI States**: Revamped `SkillPortfolioCard` to clearly distinguish unassessed skills. When an unassessed skill is rendered, an explicit warning note is presented stating: *"This skill was configured for assessment but never evaluated by the AI (likely due to time constraints). It has been excluded from scoring."*
-   **UI Refinements for Density**: Extracted long `competency_summary` texts and lengthy evidence arrays into new `ExpandableText` and `ExpandableList` sub-components, clamping long blocks and adding "Show more" toggles. This drastically improves readability on cramped portfolio views.
-   **Edge-case Handling**: Handled network failure boundaries in `PortfolioPage` and safely passed `null` states downward into `LevelBadge` and `ConfidenceIndicator`.

## Conclusion
By shipping this slice, the platform now protects candidates from unfair scoring penalties while clearly communicating to recruiters *why* a skill lacks data. The implementation was guided by product empathy, data integrity, and strict adherence to reversible, safe engineering practices.
