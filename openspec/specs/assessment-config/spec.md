# assessment-config Specification

## Purpose
TBD - created by archiving change authorized-pages-improvements. Update Purpose after archive.
## Requirements
### Requirement: Assessment form captures role title
The assessment configuration form SHALL include a role title field, reflecting PRD-02 Phase 1 setup. The role title SHALL be available to the candidate brief and system prompt compilation. When the assessment is created from or linked to a vacancy, the role title SHALL default from the vacancy and remain editable.

#### Scenario: Assessor enters role title on new assessment
- **WHEN** an assessor fills the new-assessment form including a role title
- **THEN** the saved assessment retains the role title and the candidate interview brief displays it

#### Scenario: Role title defaults from a linked vacancy
- **WHEN** an assessor links an assessment to a vacancy
- **THEN** the role title field pre-fills from the vacancy's role title and can be edited before saving

### Requirement: Save & Create Invite Link single action
The assessment configuration flow SHALL offer a "Save & Create Invite Link" action that, in one step, saves the assessment configuration, creates the first session with an invite token, and presents the invite link to the assessor, matching PRD-02 Phase 1. The existing per-candidate invite flow SHALL remain available for additional candidates.

#### Scenario: Assessor saves and creates invite link in one action
- **WHEN** an assessor clicks "Save & Create Invite Link" on a valid assessment form
- **THEN** the system creates the assessment and a pending session and displays the session's invite link for copying

#### Scenario: Save & Create Invite Link with invalid form
- **WHEN** an assessor clicks "Save & Create Invite Link" with an invalid form (e.g., no skills)
- **THEN** the system shows the validation error and creates nothing

### Requirement: System prompt preview
The system SHALL expose a read-only preview of the compiled interviewer system prompt for an assessment (N2-equivalent per PRD-01 §2), generated from the saved configuration. The preview SHALL be viewable from the assessment config and invite pages and SHALL NOT be editable.

#### Scenario: Assessor previews compiled system prompt
- **WHEN** an assessor opens the system prompt preview for a saved assessment
- **THEN** the system renders the compiled prompt containing the assessment's skills, scopes, and L1–L5 anchors

#### Scenario: Preview reflects latest config
- **WHEN** an assessor edits an assessment's skills and opens the preview again
- **THEN** the compiled prompt reflects the updated configuration

#### Scenario: Preview is read-only
- **WHEN** an assessor attempts to edit the previewed system prompt
- **THEN** the system provides no editing affordance

