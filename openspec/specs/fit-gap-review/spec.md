# fit-gap-review Specification

## Purpose
TBD - created by archiving change authorized-pages-improvements. Update Purpose after archive.
## Requirements
### Requirement: Complete fit/gap result states
The fit/gap comparison table SHALL render all four result states from the product contract — match, gap, exceed, and not assessed — with a distinct badge for `not_assessed` (when a candidate level is absent), instead of rendering it as a bare dash.

#### Scenario: Not assessed result state
- **WHEN** a skill comparison has no candidate level
- **THEN** the table shows a distinct "not assessed" badge and excludes it from match/gap/exceed summary counts

#### Scenario: Match, gap, and exceed states
- **WHEN** a skill comparison resolves to match, gap, or exceed
- **THEN** the table shows the corresponding badge with its delta (for gap/exceed)

### Requirement: Vacancy context on fit/gap report
The fit/gap report page SHALL show which vacancy the report compares against — role title and the vacancy's expected levels — so the comparison is interpretable without leaving the page (PRD-02 Phase 5).

#### Scenario: Report shows vacancy role title
- **WHEN** a fit/gap report is loaded
- **THEN** the header displays the vacancy role title alongside the report title

#### Scenario: Vacancy context with expected levels
- **WHEN** the report includes skill comparisons
- **THEN** the required-level column reflects the vacancy's expected levels for each skill

### Requirement: Evidence links from fit/gap rows
Each skill row in the fit/gap comparison SHALL offer a link to the candidate's evidence (portfolio/transcript) for that skill, so the assessor can verify the comparison source.

#### Scenario: Assessor opens evidence from a row
- **WHEN** an assessor clicks the evidence link on a fit/gap skill row
- **THEN** the system navigates to the portfolio (or transcript) focused on that skill's evidence

