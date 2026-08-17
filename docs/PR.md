# Pull Request: Candidate Reliability, Compliance & Portfolio Revamp

Branch: `feature/hadist-improvement` → `main`

## Summary

This PR walks the candidate-facing interview flow and the assessor-facing portfolio/candidate management screens end to end, fixes a data-integrity bug in the verdict system, removes a duplicated business-logic path between frontend and backend, closes a UU PDP compliance gap in candidate consent, and fixes an invite-link bug that pointed candidates at the wrong host in two separate places.

Every change ships with RSpec and/or Vitest coverage, a migration where the schema changed, and a seeded-fault proof recorded before the commit: the relevant test was broken on purpose, watched fail, then reverted.

## What's in this branch

| Severity | Count | Definition |
|---|---|---|
| P0 | 3 | Breaks a core workflow, a compliance requirement, or shows wrong data to a real decision-maker |
| P1 | 5 | Real workflow or maintainability impact, not yet broken in production |
| P2 | 3 | Moderate UX or code-health improvement |
| P3 | 1 | Cosmetic polish |
| **Total** | **12** | |

## Improvements in this branch

| # | What Improvement | What Affected | Fixed / Adds | Severity |
|---|---|---|---|---|
| 1 | Candidate consent before an interview starts (UU PDP) | `api/app/models/consent.rb`, `sessions_controller.rb`, `audio_websocket_middleware.rb`, `ConsentDialog.tsx`, `PrivacyPolicyPage.tsx` | Adds | P0 |
| 2 | Backfill verdicts for portfolios generated before the verdict feature shipped | `portfolio.rb`, migration `20260817160000` | Fixed | P0 |
| 3 | Candidate invite link pointed at the API host instead of the web app | `CandidateManagement.tsx`, `AssessmentInvitePage.tsx`, `utils/inviteLink.ts` | Fixed | P0 |
| 4 | Verdict summary sentence computed twice — once server-side as an enum, once client-side as prose | `portfolio.rb`, `portfolios_controller.rb`, `PortfolioPanel.tsx` | Fixed | P1 |
| 5 | Candidate export collapsed "not found" and "actually failed" into one status | `candidates_controller.rb` | Fixed | P1 |
| 6 | Portfolio page broke into a jumbled layout when an interview produced zero skills | `PortfolioPanel.tsx` | Fixed | P1 |
| 7 | No candidate-facing data export/delete path (documented, not built this slice) | n/a | Missing spec | P1 |
| 8 | No retention or expiry policy for transcripts/sessions (documented, not built this slice) | n/a | Missing spec | P1 |
| 9 | Export toast rendered as one unreadable run-on paragraph | `exportToast.ts` | Fixed | P2 |
| 10 | No side-by-side view to compare two candidates' portfolios | `PortfolioPage.tsx`, `CompareCandidatePicker.tsx`, `SkillPortfolioCard.tsx` | Adds | P2 |
| 11 | No encryption at rest for candidate name / transcript text (documented, not built this slice) | n/a | Missing spec | P2 |
| 12 | "Skills assessed" list sat disconnected at the page bottom | `AssessmentInvitePage.tsx` | Fixed | P3 |

## Specification files

Each row above has its own specification document under `docs/assessments/`, following the Summary / Analysis / Options & Trade-off / Solution / Acceptance Criteria / Tests & Verification structure.

| # | Improvement | Document |
|---|---|---|
| 1 | Candidate consent (UU PDP) | `assessments/01-candidate-consent-uu-pdp.md` |
| 2 | Verdict backfill | `assessments/02-portfolio-verdict-backfill.md` |
| 3 | Invite link wrong origin | `assessments/03-invite-link-wrong-origin.md` |
| 4 | Verdict summary moved server-side | `assessments/04-verdict-summary-server-side.md` |
| 5 | Candidate export status classification | `assessments/05-candidate-export-status-classification.md` |
| 6 | Zero-skills empty state | `assessments/07-zero-skills-empty-state.md` |
| 7 | Data subject rights (deferred) | `assessments/10-data-protection-deferred.md` |
| 8 | Retention/expiry policy (deferred) | `assessments/10-data-protection-deferred.md` |
| 9 | Export toast wording | `assessments/06-export-toast-wording.md` |
| 10 | Compare-candidates view | `assessments/08-compare-candidates-view.md` |
| 11 | Encryption at rest (deferred) | `assessments/10-data-protection-deferred.md` |
| 12 | Skills assessed reposition | `assessments/09-skills-assessed-reposition.md` |

## Constraint signal

Three items (rows 7, 8, 11) are documented but not implemented in this PR. Building real data-subject-rights endpoints, a retention job, and field-level encryption each touch auth model, storage layout, or infra in ways that deserve their own review cycle rather than riding along with this slice. Flagging these now so they don't get lost as "already handled."

## Engineering notes

- **Two duplicate fixes, same bug.** The invite-link bug (row 3) was found once in `CandidateManagement.tsx`, fixed, and then found again in a second file (`AssessmentInvitePage.tsx`) with the identical root cause. Both now share one `buildInviteUrl()` helper instead of each screen reconstructing the link on its own.
- **Defense in depth on consent.** The consent gate isn't just a frontend dialog — the Rails websocket middleware (`audio_websocket_middleware.rb`) independently rejects the interview connection server-side if no consent record exists, so a candidate can't bypass the dialog by hitting the API directly.
- **AI verification moment.** An early draft of the consent-gate test suite asserted on button text with an empty accessible name (`getByRole("button", { name: "" })`), which happened to pass locally but would have matched the wrong button the moment a second icon-only button existed on the page. Caught in review and replaced with an explicit `aria-label="Copy invite link"` plus a named-role query — a small instance of AI-generated test code that looked correct and would have been a silent false-positive later.
- **Test harness.** RSpec had zero specs and the web app had no test runner at the start of this engagement. Both now run in CI-ready form: 57 RSpec examples, 107 Vitest examples, `tsc --noEmit` clean.
