# portfolio-review Specification

## Purpose
TBD - created by archiving change authorized-pages-improvements. Update Purpose after archive.
## Requirements
### Requirement: Evidence quotes link to transcript turns
Each evidence quote in a portfolio skill card SHALL link to the exact transcript turn it quotes (anchored by turn number), satisfying the product principle that every AI skill score traces to verifiable transcript evidence (PRD-01 §5, PRODUCT.md principle 1).

#### Scenario: Assessor opens evidence quote in transcript
- **WHEN** an assessor clicks an evidence quote in a portfolio skill card
- **THEN** the system navigates to the transcript page scrolled to and highlighting the quoted turn

#### Scenario: Evidence quote without resolvable turn
- **WHEN** an evidence quote references a turn that no longer exists in the transcript
- **THEN** the quote renders as plain text without a broken link

### Requirement: AI draft vs assessor verdict framing
The portfolio page SHALL present the AI-generated levels as a draft that the assessor may override, making the override affordance explicit: the UI SHALL distinguish the AI rating from an assessor-applied override with visible labels for each.

#### Scenario: Override applied
- **WHEN** an assessor has applied an override to a skill
- **THEN** the portfolio shows both the AI rating and the assessor override with distinct labels and an indicator that an override exists

#### Scenario: No override applied
- **WHEN** no override exists for a skill
- **THEN** the portfolio shows the AI rating with the available override action

