# Invite Link Points at the API Host Instead of the Web App

Severity: P0 · Type: Defective implementation → Fixed

## Summary

The "copy invite link" button, in two different screens, copied a URL built from the Rails API's own base URL instead of the web app's. Any deployment where the API and the frontend run on different hosts — which is every real deployment — hands the candidate a broken link that opens the API server, not the interview page.

## Analysis

`Session#invite_url` (api/app/models/session.rb) builds `"#{ENV.fetch('APP_BASE_URL', 'http://localhost:3001')}/interview/#{invite_token}"`. `APP_BASE_URL` is the backend's own environment variable, describing where Rails itself is reachable — not where the React app is served. The frontend copied this string verbatim in `CandidateManagement.tsx`, then, separately, the same pattern turned up again in `AssessmentInvitePage.tsx`'s "new session created" card: both the displayed link text and its copy button used `invite_url`.

Locally this hid the bug entirely, since `localhost:3001` (API) and the dev-server proxy made both origins look interchangeable. It would only surface in staging or production, where a candidate receiving the link would land on a JSON API response instead of the interview page.

## Options & Trade-off

**Option A — Fix `APP_BASE_URL` in every environment's config instead of touching frontend code.**
Treats this as a deployment misconfiguration. Doesn't hold: the variable is *correctly* set to the API's own origin for whatever else might use it server-side (if anything does), and the naming genuinely suggests "this app's base URL" from the API's point of view. The bug is that the frontend trusted a backend-origin string to build a frontend-origin link, not that the env var has the wrong value.

**Option B — Frontend reconstructs the link from its own origin (chosen).**
The frontend already receives `invite_token` on every session object. `window.location.origin` is always correct by definition — it's the origin the user is already looking at. Reconstructing `${window.location.origin}/interview/${invite_token}` needs zero backend involvement and cannot drift from wherever the web app actually deployed.

**Option C — Add a dedicated `VITE_APP_BASE_URL` env var and use that instead of `window.location.origin`.**
Also correct, but adds one more environment variable someone has to remember to set per environment, for a value the browser already knows for free. Rejected as unnecessary indirection.

Option B is also strictly cheaper to test: no environment mocking, pure function of a token.

## Solution

- New `buildInviteUrl(token)` in `utils/inviteLink.ts` — `${window.location.origin}/interview/${token}`.
- `CandidateManagement.tsx`'s `copyLink` and its "copy" button visibility check switched from `session.invite_url` to `session.invite_token` via this helper.
- `AssessmentInvitePage.tsx`'s displayed link text and `copyNewSessionLink` switched the same way.
- Both call sites now share one function instead of two independent (and independently buggy) string-building spots.

## Acceptance Criteria

- The copied link always starts with the origin the assessor is currently viewing the page from, regardless of what the backend's `invite_url` says.
- The visibly displayed link text (on the "new session created" card) matches the copied link exactly.
- A session with no `invite_token` hides the copy button rather than copying an empty or malformed string.
- Existing candidates in the list (not just newly created ones) get the corrected link.

## Tests & Verification

- Vitest: `inviteLink.test.ts` (pure function correctness), `CandidateManagement.test.tsx` (copies from the frontend's own origin even when a mismatched `invite_url` is present in the fixture), `AssessmentInvitePage.test.tsx` (displayed link and copy-button link both use the frontend origin, not the backend-supplied value).
- Seeded fault: reverted the fix in each file back to `session.invite_url` / `newSession.invite_url` one at a time, watched the corresponding test fail on the mismatched-origin assertion, restored, reran green.
