## MODIFIED Requirements

### Requirement: Vacancy list with assessment-relevant summaries
The vacancy list rows SHALL show, in addition to the role title, the vacancy's skills with expected levels and culture dimensions, so assessors can compare vacancies at a glance (PRD-02 Phase 5 context). The list SHALL support search/filter by role title or skill. The list SHALL render resiliently when a vacancy's skills are absent or empty in the response, showing a "no skills configured" note rather than failing the page.

#### Scenario: Vacancy row shows skills and expected levels
- **WHEN** the vacancy list loads
- **THEN** each row displays the role title and a summary of its skills with expected levels

#### Scenario: Search vacancies
- **WHEN** an assessor types in the vacancy search box
- **THEN** the list filters to vacancies whose role title or skills match

#### Scenario: Vacancy with absent or empty skills renders safely
- **WHEN** the list contains a vacancy whose skills are missing or empty in the response
- **THEN** the row renders with a "No skills configured" note and the page does not show an error state

## ADDED Requirements

### Requirement: Vacancy list response includes skill summaries
The vacancy list endpoint SHALL include, for each vacancy, a summary of its skills (at least skill label and expected level), consistent with the single-vacancy endpoints, so the list can render skill chips and support search by skill.

#### Scenario: List endpoint returns skills per vacancy
- **WHEN** a client requests the vacancy list
- **THEN** each returned vacancy includes its skills with at least a skill label and expected level

#### Scenario: List retrieval avoids per-vacancy skill queries
- **WHEN** the vacancy list is assembled for multiple vacancies
- **THEN** the skills are loaded without issuing a separate query per vacancy (no N+1)
