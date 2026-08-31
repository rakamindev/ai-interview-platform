---
agent: devin-local
session: fourth-toucan
created: 2026-08-17T23:09:49Z
---

# User Authentication and Session Mapping Solution

Implement a candidate-friendly authentication system that allows self-service account creation while maintaining strict admin dashboard access control.

## Problem Analysis

Current authentication system has these limitations:

1. **Authentication Controller**: Only allows admin users to login (line 14 in `authentication_controller.rb`)
2. **User Roles**: System has "admin" and "user" roles, but only "admin" can authenticate
3. **Assessment Invite**: Only collects candidate name, not email/user identity
4. **Session Mapping**: `candidate_id` field exists but is nullable, preventing proper user tracking
5. **API Protection**: All endpoints require `:assessor` role (admin only currently)

## User Requirements (Based on Feedback)

1. **Account Creation**: Candidates can create their own accounts via signup (self-service)
2. **Data Migration**: Keep historical sessions separate (no retroactive user account creation)
3. **User Access**: No admin dashboard access for candidates (simple interview history view only)

## Recommended Solution: Simplified Candidate Self-Service System

This approach focuses on enabling candidate self-service accounts while maintaining strict admin access control.

## Implementation Plan

### Phase 1: Enable User Authentication

#### 1.1 Update Authentication Controller

**File**: `api/app/controllers/api/v1/authentication_controller.rb`

- Remove admin-only restriction from login (line 14)
- Allow both "admin" and "user" roles to authenticate
- Keep role validation for signup (already allows user role)
- Update error messages to be more specific

#### 1.2 Update Role System

**File**: `api/app/auth/authorize_api_request.rb`

- Ensure "user" role is properly handled in authentication
- Keep `ASSESSOR_ROLES` as ["admin", "assessor"] for admin endpoints
- Ensure proper role checking for different endpoint types

#### 1.3 Keep API Protection Unchanged

- Keep `:assessor` requirement for all admin dashboard endpoints
- Keep invite token endpoints accessible without authentication
- No need to add candidate-accessible API endpoints

### Phase 2: Add Candidate History Page

#### 2.1 Create Candidate History Page

**File**: `web/src/pages/candidate/CandidateHistoryPage.tsx` (new)

- Simple page showing candidate's own interview sessions
- Accessible only to logged-in users with "user" role
- Shows session status, assessment name, completion date
- Links to portfolio results for completed sessions
- Protected by route authentication

#### 2.2 Add Backend Endpoint for Candidate Sessions

**File**: `api/app/controllers/api/v1/sessions_controller.rb`

- Add `my_sessions` action to show current user's sessions
- Use `authorize_auth_token! :any` to allow any authenticated user
- Filter sessions by `current_user.id` = `candidate_id`
- Return simple session list for candidate history

#### 2.3 Update Routes

**File**: `api/config/routes.rb`

- Add route: `GET /api/v1/sessions/my_sessions`
- Keep admin routes protected with `:assessor`

### Phase 3: Update Assessment Invite (Optional Enhancement)

#### 3.1 Update Assessment Invite Page

**File**: `web/src/pages/assessments/AssessmentInvitePage.tsx`

- Add optional email input field to invite dialog
- Add "Link to existing user" checkbox
- If email provided, lookup user and populate `candidate_id`
- Keep backward compatible: if no email, create session without user

#### 3.2 Update Backend Session Creation

**File**: `api/app/controllers/api/v1/sessions_controller.rb`

- Update `create` action to handle optional `candidate_email` parameter
- If email provided, find user by email and set `candidate_id`
- If no email or user not found, create session without user (backward compatible)
- Keep existing `candidate_name` functionality

### Phase 4: Add User Lookup API (Optional)

#### 4.1 Add User Search Endpoint

**File**: `api/app/controllers/api/v1/users_controller.rb` (new)

- Create simple controller for user lookup
- Add endpoint: `GET /api/v1/users/search?email=xxx` - search users by email
- Protect with `:assessor` role (admin only)
- Return minimal user info (id, email, role)

#### 4.2 Update Routes

**File**: `api/config/routes.rb`

- Add user search route under `:assessor` protection

### Phase 5: Testing and Validation

#### 5.1 Authentication Tests

- Test user login with "user" role
- Test role-based access control (users cannot access admin endpoints)
- Test signup flow for new users

#### 5.2 Session Creation Tests

- Test session creation with existing user (via email)
- Test session creation without user (backward compatible)
- Test candidate_id population in both scenarios

#### 5.3 Integration Tests

- Test full flow: user signup → login → assessment invite → interview
- Test websocket authentication with user tokens
- Verify candidate_id population in all scenarios
- Test candidate history page access and data

## Files to Modify

### Backend

- `api/app/controllers/api/v1/authentication_controller.rb` - Remove admin-only login restriction
- `api/app/controllers/api/v1/sessions_controller.rb` - Add my_sessions action, update create action
- `api/app/controllers/api/v1/users_controller.rb` - New controller for user lookup (optional)
- `api/config/routes.rb` - Add candidate history and user search routes

### Frontend

- `web/src/pages/candidate/CandidateHistoryPage.tsx` - New page for candidate interview history
- `web/src/pages/assessments/AssessmentInvitePage.tsx` - Add optional email input (optional enhancement)
- `web/src/services/users.ts` - New service for user API calls (optional)
- `web/src/services/assessments.ts` - Update createSession to include candidate_id (optional)

## Benefits

1. **User Self-Service**: Candidates can create accounts and track their interview history
2. **Simplified Access**: Clear separation - admins get dashboard, candidates get history page
3. **Backward Compatible**: Existing invite token workflow still works
4. **No Data Migration**: Historical sessions remain separate, avoiding complex migration
5. **Minimal Admin Overhead**: No need for complex user management UI initially
6. **Scalable**: Foundation for future candidate features while keeping it simple now

## Risks and Considerations

1. **Role Simplicity**: Only two roles (admin/user) keeps permissions straightforward
2. **Limited Candidate Features**: No admin dashboard access keeps security simple
3. **Historical Data**: Past interviews without user accounts won't appear in candidate history
4. **User Privacy**: Ensure candidate data is properly protected and not accessible to other users
5. **Optional Complexity**: Email lookup in invite page is optional enhancement, can be added later

## Alternative Options Considered

### Option 1: Allow User Login + API Guards

- **Pros**: Simpler implementation
- **Cons**: Candidates would have no way to view their history without new pages

### Option 2: Email Input at InterviewPage

- **Pros**: Minimal changes
- **Cons**: Doesn't create user accounts, can't track interview history

### Option 3: Email Input at AssessmentInvitePage

- **Pros**: Better timing for user identification
- **Cons**: Still doesn't solve user account creation or history viewing

### Option 4: Full Hybrid System (Original Plan)

- **Pros**: Maximum flexibility and features
- **Cons**: More complex than needed based on requirements

**Chosen Approach**: Simplified self-service system with candidate history page and optional email lookup.
