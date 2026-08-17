## ADDED Requirements

### Requirement: Assessor routes require admin role
The system SHALL restrict all authorized (post-login) assessor routes — assessments, vacancies, monitor, portfolio, transcript, fit-gap — to authenticated users with the `admin` role. A non-admin authenticated user SHALL be redirected to a defined destination with a clear message rather than rendered the assessor surface.

#### Scenario: Admin user accesses assessor route
- **WHEN** an authenticated user with role `admin` navigates to `/assessments`
- **THEN** the system renders the assessment list page

#### Scenario: Non-admin user accesses assessor route
- **WHEN** an authenticated user with role `user` navigates to `/assessments`
- **THEN** the system redirects them away from the assessor surface and shows an access-denied message

#### Scenario: Unauthenticated user accesses assessor route
- **WHEN** a user with no token navigates to `/assessments`
- **THEN** the system redirects to `/login`

### Requirement: Session-expired handling on stale tokens
When an authorized page receives a 401 due to an expired or invalid token, the system SHALL surface a "session expired, sign in again" state with a sign-in action instead of an unhandled hard reload, preserving a clear path back to authentication.

#### Scenario: Stale token on an authorized page
- **WHEN** an authorized page request returns 401 from the API
- **THEN** the system clears the token, shows a session-expired message with a sign-in button, and navigates to `/login` on confirmation

#### Scenario: Login failure is not treated as session expiry
- **WHEN** the user submits invalid credentials on the login page
- **THEN** the system shows the credential error and does not trigger the session-expired flow