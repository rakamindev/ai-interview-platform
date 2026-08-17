## ADDED Requirements

### Requirement: Vacancy list with assessment-relevant summaries
The vacancy list rows SHALL show, in addition to the role title, the vacancy's skills with expected levels and culture dimensions, so assessors can compare vacancies at a glance (PRD-02 Phase 5 context). The list SHALL support search/filter by role title or skill.

#### Scenario: Vacancy row shows skills and expected levels
- **WHEN** the vacancy list loads
- **THEN** each row displays the role title and a summary of its skills with expected levels

#### Scenario: Search vacancies
- **WHEN** an assessor types in the vacancy search box
- **THEN** the list filters to vacancies whose role title or skills match

### Requirement: Expected levels in fit/gap vacancy picker
The vacancy picker on the portfolio page SHALL show each vacancy's skills and expected levels inline in the option, so the assessor selects the comparison vacancy deliberately.

#### Scenario: Picker shows expected levels
- **WHEN** an assessor opens the fit/gap vacancy picker
- **THEN** each option displays the vacancy role title plus its skills with expected levels

#### Scenario: Picker option without skills
- **WHEN** a vacancy has no configured skills
- **THEN** its picker option shows the role title and a note that no skills are configured