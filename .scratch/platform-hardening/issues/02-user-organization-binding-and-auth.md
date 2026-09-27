# 02-user-organization-binding-and-auth

Status: resolved
Blocked by: none

## Context
1. `users` table has no `organization_id` foreign key.
2. `AuthenticationController#resolve_scheme` trusts client `X-Tenant-Scheme`, allowing cross-tenant impersonation.
3. `User::ROLES` in `user.rb` is `%w[admin user]`, rejecting assessors.
4. `AuthenticationController#authenticate` rejects any non-admin with 401 Unauthorized.
5. Seeds contain 0 users.

## Implementation Details
1. Create a Rails migration `AddOrganizationIdToUsers`:
   `add_reference :users, :organization, null: true, foreign_key: { to_table: :organizations }` in schema `ai_interview`.
2. Update `api/app/models/user.rb`:
   - `ROLES = %w[admin assessor user].freeze`
   - `belongs_to :organization, optional: true`
3. Update `api/app/controllers/api/v1/authentication_controller.rb`:
   - Allow `user.role.in?(%w[admin assessor])` (remove line 14 admin-only check).
   - Resolve scheme strictly from `user.organization&.scheme || Organization.first&.scheme`, ignoring client `X-Tenant-Scheme` header.
4. Update `api/db/seeds.rb` to create default admin and assessor users bound to `Test Corp` (`organization_id: 1`).
5. Update `api/spec/requests/api/v1/authentication_spec.rb` to test:
   - Login as `assessor` succeeds and returns JWT with user's organization scheme.
   - Sending arbitrary `X-Tenant-Scheme` does not override user's bound organization scheme.

## Verification
- `cd api && bundle exec rspec spec/requests/api/v1/authentication_spec.rb`

## Answer
- Created migration `20260505000003_add_organization_id_to_users.rb` adding `organization_id` reference and foreign key to `users` referencing `public.organizations`.
- Updated `User` model (`api/app/models/user.rb`) with `belongs_to :organization, optional: true` and `ROLES = %w[admin assessor user].freeze`.
- Updated `AuthenticationController` (`api/app/controllers/api/v1/authentication_controller.rb`) to allow both `admin` and `assessor` roles to log in, and strictly resolve tenant scheme via `user.organization&.scheme || Organization.first&.scheme`, ignoring any client-supplied `X-Tenant-Scheme` header.
- Updated `api/db/seeds.rb` to create both `admin@test.com` and `assessor@test.com` bound to `Test Corp`.
- Added model specs in `api/spec/models/user_spec.rb` and request specs in `api/spec/requests/api/v1/authentication_spec.rb` verifying assessor login, cross-tenant protection, and fallback scheme resolution.
- All 43 backend tests and 17 frontend tests pass.
