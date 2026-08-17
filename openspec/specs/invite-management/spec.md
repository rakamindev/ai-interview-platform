# invite-management Specification

## Purpose
TBD - created by archiving change authorized-pages-improvements. Update Purpose after archive.
## Requirements
### Requirement: Invite revocation and expiry
The system SHALL allow an assessor to revoke a pending invite, after which the invite link SHALL no longer start a session and SHALL display a revoked state. Newly created invites SHALL support an expiry, after which they display an expired state and SHALL NOT start a session.

#### Scenario: Assessor revokes a pending invite
- **WHEN** an assessor revokes a pending invite
- **THEN** the invite row shows a revoked state, copy-link is disabled, and opening the link no longer starts an interview

#### Scenario: Invite passes its expiry
- **WHEN** a pending invite reaches its expiry time
- **THEN** the invite row shows an expired state and the link no longer starts an interview

#### Scenario: Active session invite cannot be revoked
- **WHEN** an invite has an active (live) session
- **THEN** the system does not offer revocation for that invite

### Requirement: Transcript shortcut for ended sessions
The invite page SHALL provide a direct transcript link for ended sessions, alongside the existing results action, so assessors reach the evidence without navigating through the portfolio page.

#### Scenario: Assessor opens transcript from ended session
- **WHEN** an assessor clicks the transcript action on an ended session row
- **THEN** the system navigates to that session's transcript page

#### Scenario: No transcript shortcut for live sessions
- **WHEN** a session is live
- **THEN** the invite row shows the monitor action instead of the transcript action

### Requirement: Invite page context summary
The invite page header SHALL show the assessment's role title, expected skill levels, and skill count so the assessor knows what an invite is for before sending it, per PRD-02 Phase 1 context.

#### Scenario: Invite page shows role and expected levels
- **WHEN** an assessor opens the invite page for an assessment with configured skills
- **THEN** the header displays the role title, skill count, and expected level for each configured skill

#### Scenario: Invite page without role title
- **WHEN** an assessment has no role title configured
- **THEN** the invite page header shows the assessment name and skill information without a role title

