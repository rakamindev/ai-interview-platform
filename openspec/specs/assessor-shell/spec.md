# assessor-shell Specification

## Purpose
TBD - created by archiving change authorized-pages-improvements. Update Purpose after archive.
## Requirements
### Requirement: Live-session indicator in assessor shell
The assessor layout header SHALL surface active session activity (e.g., a "live now" count), so the assessor can reach a live session without scanning the assessment list (PRD-02 Phase 3 monitoring job awareness).

#### Scenario: Live sessions exist
- **WHEN** one or more sessions are active and an assessor is on any authorized page
- **THEN** the header shows an indicator with the live session count linking to the relevant monitor page

#### Scenario: No live sessions
- **WHEN** no sessions are active
- **THEN** the header shows no live indicator

### Requirement: Assessor identity display
The assessor layout SHALL display the signed-in user's identity (name/email from the token or profile endpoint), alongside the existing tenant chip, so the active assessor is always visible.

#### Scenario: Identity rendered in header
- **WHEN** an assessor is signed in with identity claims in the token
- **THEN** the header displays the user's name or email

#### Scenario: Identity unavailable
- **WHEN** identity claims are missing from the token
- **THEN** the header renders without identity rather than with a broken value

### Requirement: Branded loading fallback
Authorized routes SHALL render the assessor variant of the shared route-aware branded skeleton for lazy route loading, instead of plain "Loading..." text. The branded skeleton is no longer exclusive to authorized routes; the assessor silhouette is its default variant, while auth and interview routes render their own silhouettes (see the `route-loading-skeleton` capability).

#### Scenario: Lazy route loading
- **WHEN** an authorized route chunk is loading
- **THEN** the fallback shows the branded skeleton with the assessor silhouette (top nav + wide content)

### Requirement: Consistent error and retry states
Authorized pages SHALL surface load failures with a visible error state and a retry action, replacing silent `.catch(() => {})` swallows, so failures are actionable.

#### Scenario: Page load failure shows retry
- **WHEN** an authorized page's initial data request fails
- **THEN** the page shows an error state with a retry button that re-issues the request

#### Scenario: Retry succeeds
- **WHEN** an assessor clicks retry after a transient failure
- **THEN** the page loads successfully and the error state is replaced by content

### Requirement: Accessibility of tables and coverage states
Data tables on authorized pages (session rows, fit/gap comparison) SHALL provide accessible semantics (caption or `aria-label`, sortable headers marked with `aria-sort`). Coverage map states on the live monitor SHALL convey state via more than color alone (text labels already present; SHALL remain so).

#### Scenario: Table announced with accessible name
- **WHEN** a screen reader encounters the fit/gap comparison table
- **THEN** the table is announced with its accessible name

#### Scenario: Coverage state conveyed without color
- **WHEN** a coverage map entry is in a given state
- **THEN** the state is conveyed by text label in addition to any color treatment

