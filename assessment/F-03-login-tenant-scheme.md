# F-03 — Authentication Tenant Binding and Invitation-Gated Administrator Signup

> **Finding:** F-03 (severity: P1) · **Classification:** Defective Implementation · **Area:** Authentication / Multi-tenant authorization (Fullstack) · **UU PDP:** Yes (related)
> **Branch:** `fix/admin-invitation-signup` · **Status:** ✅ Completed & verified (original fix plus reviewer security follow-up)

---

## 1. Summary

The original F-03 defect allowed login to bind a user to an arbitrary organization because users had no persisted organization relation. That defect remains fixed: every user belongs to one organization through `users.tenant_id`, login accepts only email and password, and the JWT tenant scheme is derived from the persisted user relation.

A reviewer follow-up identified a second authorization gap in the onboarding path. Public `/signup` allowed an unauthenticated visitor to choose any organization and immediately receive an `admin` account and administrator JWT. Correct tenant derivation did not prove that the registrant was authorized to join that tenant.

The follow-up replaces public administrator registration with a dedicated invitation flow. An existing administrator issues an email- and tenant-bound, expiring, single-use invitation. The server stores only a SHA-256 token digest, derives tenant and the fixed `admin` role exclusively from the invitation, consumes it atomically with user creation, and issues a JWT only after the transaction commits. Candidate interview invitations remain a separate mechanism.

## 2. Analysis & Gap to Ideal

The initial root cause was missing identity-to-tenant ownership. Adding `users.tenant_id` made login tenant-implicit and structurally prevented a login request from selecting another tenant. The follow-up exposed a different boundary: **membership authorization**. A persisted tenant relation is trustworthy only when a trusted process controls how that relation is created.

Before the follow-up:

| Layer | Gap |
|---|---|
| Backend signup | Accepted public `organization_id`, created role `admin`, and returned a JWT without an authorization grant |
| Public API | Exposed an organization listing solely to populate the signup selector |
| Frontend signup | Let any unauthenticated visitor select an organization and auto-login as administrator |
| Auditability | Stored no inviter, recipient binding, expiry, revocation, or acceptance evidence |

The ideal condition is:

1. Login tenancy continues to come from the persisted user relation.
2. Only an authenticated, persisted administrator may grant administrator membership.
3. The grant is bound to one tenant, recipient email, inviter, expiry, and single-use state.
4. Raw invitation tokens are never stored or logged.
5. Signup cannot use client-supplied tenant or role as authorization input.
6. Failed user creation, including duplicate email, does not consume the invitation.
7. Candidate interview tokens cannot authorize administrator signup.

**Related finding — F-10 (scope correction).** F-10 described the unusable legacy `user` role and missing signup path. This follow-up does not introduce general role invitations or broader RBAC. Administrator invitations have no selectable role and always assign `admin` server-side. F-10 remains outside the original finding count, while its prior narrative—public signup hardcoding `admin` as a resolution—has been corrected in the aggregate README.

## 3. Options & Trade-offs

### Option A — Existing-administrator invitation ✅ Chosen and implemented

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | An authenticated admin issues an email-bound token; the recipient opens the link; backend validation and redemption derive tenant and `admin` role from the invitation. |
| **Product Impact** | Provides a direct, understandable onboarding path with explicit organization authorization and a protected management UI. |
| **Cost & Complexity** | Medium: migration, digest/token lifecycle, transactional redemption, protected API/UI, and full-stack tests. |
| **Long-Term Maintainability** | Strong for the current one-account/one-organization model; authorization evidence is explicit and auditable. |
| **Failure Modes** | Token leakage, expiry during onboarding, duplicate redemption, wrong email, stale JWT, or failed user creation. |
| **Operational Risks** | Initial installations still need a trusted bootstrap administrator; links require manual delivery until email infrastructure exists. |
| **Mitigations** | High-entropy token, digest-only storage, 24-hour expiry, revocation, row lock, generic public errors, rate limiting, and retry-safe transaction rollback. |
| **Contextual Fit** | Best fit for the current product because existing admins are the trusted membership authority and no verified-email infrastructure exists. |

### Option B — Verified-domain eligibility ❌ Not selected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | Backend maps verified organization domains; signup requires verified email ownership and derives tenant from the verified domain. |
| **Product Impact** | Low-friction self-service onboarding for organizations with stable, exclusive domains. |
| **Cost & Complexity** | High: email delivery, verification lifecycle, domain ownership administration, retries, and support paths. |
| **Long-Term Maintainability** | Reasonable at scale, but domain policies become a separate authorization subsystem. |
| **Failure Modes** | Shared domains, contractors, aliases, domain ownership changes, delayed email, and compromised mailboxes. |
| **Operational Risks** | A domain misconfiguration can grant broad access; email infrastructure becomes security-critical. |
| **Mitigations** | Domain verification, deny/allow policies, audited changes, verified-email expiry, and manual exception handling. |
| **Contextual Fit** | Not suitable for this repository because it has no verified-email flow and the implementation cost exceeds the current onboarding scope. |

### Option C — Pending account with explicit administrator approval ❌ Not selected

| Dimension | Assessment |
|---|---|
| **End-to-End Behavior** | A registrant requests access; backend stores a non-privileged pending account; an existing admin reviews and approves membership. |
| **Product Impact** | Supports unsolicited access requests and gives administrators a review queue. |
| **Cost & Complexity** | High: pending identity state, approval/rejection lifecycle, notifications, duplicate handling, and recovery UX. |
| **Long-Term Maintainability** | Flexible, but introduces a broader membership workflow and more persistent states than the product currently needs. |
| **Failure Modes** | Approval backlog, duplicate requests, accidental approval, abandoned accounts, and race conditions with repeated decisions. |
| **Operational Risks** | Administrators must monitor a queue; unreviewed personal data remains stored. |
| **Mitigations** | Expiring requests, deduplication, audit logs, notifications, least-privilege pending state, and cleanup jobs. |
| **Contextual Fit** | Disproportionate for the current deadline and product because onboarding is initiated by known administrators. |

Option A was selected because it supplies an explicit, auditable grant with materially lower lifecycle complexity than domain verification or a pending-account system.

## 4. Solution Implemented

### Existing tenant-implicit login retained

- `users.tenant_id` remains NOT NULL with an organization foreign key.
- `User` remains bound to one organization.
- Login still accepts email and password only and derives JWT `scheme` from `user.organization`.
- Client tenant headers cannot override the user's persisted organization.

### Invitation persistence and token handling

- Added `administrator_invitations` with UUID identity, `tenant_id`, `inviter_id`, normalized `recipient_email`, unique SHA-256 `token_digest`, `expires_at`, `accepted_at`, `revoked_at`, timestamps, indexes, foreign keys, and a terminal-state check constraint.
- Invitation issuance uses a 32-byte URL-safe random token and a server-owned 24-hour expiry.
- Only the digest is persisted. The raw signup link is returned once on creation and is absent from list responses.
- Rails filters invitation tokens, token digests, and passwords from request and SQL bind logs.

### Protected administrator management

- Added authenticated create, list, and revoke endpoints.
- The persisted inviter is reloaded from the database and must still be an `admin` in the JWT tenant.
- Tenant scope comes from the persisted inviter, never request input.
- Cross-tenant invitation lookup returns no invitation data.
- Added a protected responsive UI for create, one-time copy, list, status display, retry, empty state, and revocation.

### Public validation and atomic redemption

- Public validation accepts the raw token in a POST body and returns only bound email, organization name, and expiry for an active invitation.
- Missing, malformed, unknown, expired, revoked, or accepted tokens receive the same `invalid_invitation` response.
- Signup accepts only invitation token, email, and password as its functional contract.
- Redemption locks the invitation row inside the same database transaction that creates the user and writes `accepted_at`.
- Tenant comes from the invitation and role is the backend-owned literal `admin`; supplied `organization_id`, `tenant_id`, or `role` values are ignored.
- JWT issuance happens only after transaction success.
- A duplicate email or other user validation failure rolls back without consuming the invitation.
- Public organization listing and its frontend service were removed because no remaining flow consumes them.

### Frontend onboarding

- `/signup` without an invitation shows an invitation-required state and no registration form.
- A valid invitation auto-populates the email as read-only and organization as disabled/read-only informational context.
- The organization field is never submitted as authority.
- Invalid/unavailable and network failures are distinct; network failure supports retry.
- The login page no longer advertises a public signup link.
- Candidate invitation routes and behavior are unchanged.

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Expected behavior | Verification |
|---|---|---|---|
| 1 | Login tenant remains authoritative | JWT scheme comes from `user.organization`; request headers cannot override it | RSpec regression |
| 2 | No-invitation signup | No user or JWT; `422 invalid_invitation` | RSpec, API smoke test, browser verification |
| 3 | Valid administrator invitation | Creates one `admin` for the invitation tenant and email | RSpec and browser verification |
| 4 | Tenant display | Organization appears automatically and disabled/read-only | Vitest and browser verification |
| 5 | Client tampering | Supplied tenant/organization/role cannot alter persisted tenant or role | RSpec and request-contract Vitest |
| 6 | Token lifecycle | Missing, malformed, expired, revoked, accepted, and wrong-email requests are rejected generically | RSpec |
| 7 | Single use under concurrency | Two simultaneous redemptions create at most one user | Two-connection PostgreSQL race test |
| 8 | Duplicate email | Returns validation failure while invitation remains active | RSpec |
| 9 | Tenant isolation | Admins list/revoke only invitations from their persisted tenant | RSpec |
| 10 | Existing administrators | Existing accounts retain login and protected application access | Login regression and browser verification |
| 11 | Candidate separation | Candidate session tokens cannot redeem administrator signup | RSpec |
| 12 | Secret handling | Raw token absent from persistence/list responses/logs | Model/request tests and log smoke test |
| 13 | Public organization discovery | Signup no longer depends on or exposes the organization picker endpoint | Route and frontend regression tests |
| 14 | UI failure states | Loading, empty, invalid, network retry, create, copy, and revoke states do not report false success | Vitest |

## 6. Tests & Verification

- **Backend:** model coverage for email normalization, digest uniqueness, derived status, and terminal state; request coverage for issue/list/revoke authorization and tenant isolation; signup coverage for every invalid state, tampering, duplicate email rollback, candidate-token separation, JWT tenant, and single-use behavior; a real two-connection PostgreSQL race test verifies atomic redemption.
- **Frontend:** invitation-gated signup tests cover missing token, validation, disabled tenant, read-only email, request shape, invalid/unavailable state, retry, password behavior, duplicate email, and navigation. Management-page tests cover empty state, create, one-time link copy, list, revoke, failure, and retry. Navigation and login tests cover the protected menu and absence of a public signup CTA.
- **Full RSpec:** **98 examples, 0 failures**.
- **Full Vitest:** **61 tests, 0 failures**.
- **TypeScript and production build:** passed.
- **API smoke:** a no-invitation request containing `organization_id` and `role` returned `422 invalid_invitation`; no user was created. Rails logs showed invitation token, digest, and password values as `[FILTERED]`.
- **Manual before:** public signup selected `Test Corp`, created an administrator, and redirected directly to `/assessments`, proving the issue.
- **Manual after:** no-token signup was blocked; an existing administrator created and copied an invitation; the recipient saw the invitation-bound tenant and email, signed up successfully, and reached `/assessments`; reused and revoked links were unavailable. The login-page signup link was removed and visually verified.

## 7. AI-Human Verification

1. **Tenant binding was initially mistaken for membership authorization.** The earlier solution correctly derived login tenancy but left public administrator creation open. Reviewer feedback separated these two security boundaries and required a server-issued administrator grant. The correction is the invitation flow documented here.
2. **Migration index length.** The first migration run surfaced PostgreSQL's 63-character index-name limit. Explicit shorter index names were added before the migration completed successfully.
3. **Development verification origin.** The first browser instruction used `127.0.0.1`, while development CORS allowed `localhost`. The API returned 200 but the browser blocked the response. Verification was corrected to `http://localhost:5173` without weakening CORS.
4. **Login CTA scope.** The first follow-up UI retained a signup link on the login page. Manual review determined it was no longer relevant for invitation-only onboarding, so the CTA and unused import were removed and a regression test now asserts its absence.

---

*F-03 completed and verified: tenant-implicit login is preserved, while administrator membership is now granted only through secure, tenant-bound, single-use invitations.*
