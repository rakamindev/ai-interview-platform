## ADDED Requirements

### Requirement: Route-aware loading skeleton selection
The branded loading skeleton SHALL choose its silhouette from the current route so the lazy-loading fallback matches the shell being loaded. The assessor silhouette SHALL be the default for any route that is not an auth or interview route.

#### Scenario: Auth route chunk loading
- **WHEN** the fallback renders while the current path is `/login`, `/signup`, or `/access-denied`
- **THEN** the skeleton shows the auth silhouette

#### Scenario: Interview route chunk loading
- **WHEN** the fallback renders while the current path starts with `/interview/`
- **THEN** the skeleton shows the interview silhouette

#### Scenario: Authorized route chunk loading
- **WHEN** the fallback renders while the current path is an authorized route such as `/assessments` or `/vacancies`
- **THEN** the skeleton shows the assessor silhouette

#### Scenario: Unmatched route uses default silhouette
- **WHEN** the fallback renders for a path that matches neither the auth nor the interview routes
- **THEN** the skeleton shows the assessor silhouette as the default

### Requirement: Auth loading silhouette matches the auth shell
The auth silhouette SHALL visually approximate `AuthShell`: a two-column split on large viewports with a solid primary/teal side-panel placeholder and a centered form placeholder, collapsing to a single centered column on small viewports. It SHALL NOT render the assessor top-nav or navigation pills.

#### Scenario: Auth silhouette on large viewport
- **WHEN** the auth silhouette renders on a large viewport
- **THEN** it shows a solid teal side-panel placeholder alongside a centered form placeholder

#### Scenario: Auth silhouette hides assessor navigation
- **WHEN** the auth silhouette renders
- **THEN** no assessor navigation pills are shown

### Requirement: Interview loading silhouette matches the candidate shell
The interview silhouette SHALL visually approximate `CandidateLayout`: a minimal, non-sticky header and a narrow centered content column. It SHALL NOT render the assessor top-nav or navigation pills.

#### Scenario: Interview silhouette structure
- **WHEN** the interview silhouette renders
- **THEN** it shows a minimal header and a narrow centered content placeholder

#### Scenario: Interview silhouette hides assessor navigation
- **WHEN** the interview silhouette renders
- **THEN** no assessor navigation pills are shown
