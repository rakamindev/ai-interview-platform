# Demo script — reliable candidate invitation

Target duration: 3–5 minutes. Record only the local synthetic environment;
do not show configuration files, real tokens, credentials, or personal data.

## 0:00–0:30 — Problem and user impact

Open the assessment report. Explain that the critical handoff is assessor
invite → candidate interview → hiring evidence. Before the change the server
generated an API-host URL even though the candidate route belongs to the SPA,
so a valid invite could lead to a 404 and prevent any assessment signal.

## 0:30–1:20 — Product decision

Show the options table in `assessment/README.md`. State why Option B was
chosen: `WEB_APP_BASE_URL` makes the public web origin explicit, keeps the
existing capability-token model, avoids an unnecessary migration, and adds a
truthful recovery state for the affected candidate.

## 1:20–2:10 — Code walkthrough

Show `api/app/models/session.rb` and point out that `invite_url` now derives
from `WEB_APP_BASE_URL` and removes trailing slashes. Then show
`InterviewPage.tsx` and `candidateAccessState.ts`: metadata loading, pending
or active, completed, and unavailable have distinct UI states. Do not read or
display a live invite token.

## 2:10–3:00 — Behaviour demonstration

Open the valid synthetic invite route. Show that it arrives at the candidate
readiness screen. Then navigate to an intentionally invalid token and show
the neutral “This interview link isn’t available” recovery message. Explain
that it replaces the former false “Interview Complete” outcome.

## 3:00–3:40 — Quality evidence and limits

Show the passing RSpec and Vitest commands/output and mention the seeded-fault
scratch branch: changing the origin back to the API host made the URL contract
spec fail, then the change was reverted. Note that Gemini live interview was
not exercised because no development model key was used; deterministic invite
and state paths are covered. Close with the recorded Puma multi-worker signal
as a follow-up investigation, rather than claiming it is fixed.
