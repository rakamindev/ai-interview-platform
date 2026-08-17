# Pull Request: Candidate Reliability, Compliance & Portfolio Revamp

Branch: `feature/hadist-improvement` → `main`

## Summary

This PR walks the candidate-facing interview flow and the assessor-facing portfolio/candidate management screens end to end, fixes a data-integrity bug in the verdict system, removes a duplicated business-logic path between frontend and backend, closes UU PDP compliance gaps in candidate consent, data subject rights, retention, and encryption at rest, and fixes an invite-link bug that pointed candidates at the wrong host in two separate places.

Every change ships with RSpec and/or Vitest coverage, a migration where the schema changed, and a seeded-fault proof recorded before the commit: the relevant test was broken on purpose, watched fail, then reverted.

## What's in this branch

| Severity | Count | Definition |
|---|---|---|
| P0 | 3 | Breaks a core workflow, a compliance requirement, or shows wrong data to a real decision-maker |
| P1 | 6 | Real workflow or maintainability impact, not yet broken in production |
| P2 | 4 | Moderate UX or code-health improvement |
| P3 | 1 | Cosmetic polish |
| **Total** | **14** | |

## Improvements in this branch

| # | What Improvement | What Affected | Fixed / Adds | Severity |
|---|---|---|---|---|
| 1 | Candidate consent before an interview starts (UU PDP) | `api/app/models/consent.rb`, `sessions_controller.rb`, `audio_websocket_middleware.rb`, `ConsentDialog.tsx`, `PrivacyPolicyPage.tsx` | Adds | P0 |
| 2 | Backfill verdicts for portfolios generated before the verdict feature shipped | `portfolio.rb`, migration `20260817160000` | Fixed | P0 |
| 3 | Candidate invite link pointed at the API host instead of the web app | `CandidateManagement.tsx`, `AssessmentInvitePage.tsx`, `utils/inviteLink.ts` | Fixed | P0 |
| 4 | Verdict summary sentence computed twice — once server-side as an enum, once client-side as prose | `portfolio.rb`, `portfolios_controller.rb`, `PortfolioPanel.tsx` | Fixed | P1 |
| 5 | Candidate export collapsed "not found" and "actually failed" into one status | `candidates_controller.rb` | Fixed | P1 |
| 6 | Portfolio page broke into a jumbled layout when an interview produced zero skills | `PortfolioPanel.tsx` | Fixed | P1 |
| 7 | Candidate self-service data access/deletion (UU PDP) | `sessions_controller.rb`, `session.rb`, `MyDataDialog.tsx` | Adds | P1 |
| 8 | Retention/expiry policy for candidate personal data (UU PDP) | `session.rb`, `end_handler.rb`, `lib/tasks/retention.rake` | Adds | P1 |
| 9 | Export toast rendered as one unreadable run-on paragraph | `exportToast.ts` | Fixed | P2 |
| 10 | No side-by-side view to compare two candidates' portfolios | `PortfolioPage.tsx`, `CompareCandidatePicker.tsx`, `SkillPortfolioCard.tsx` | Adds | P2 |
| 11 | Encryption at rest for transcript text (UU PDP) | `transcript_turn.rb`, `config/application.rb`, `config/initializers/active_record_encryption.rb` | Adds (partial — see doc) | P2 |
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
| 7 | Candidate data subject rights | `assessments/10-candidate-data-subject-rights.md` |
| 8 | Retention/expiry policy | `assessments/11-retention-policy.md` |
| 9 | Export toast wording | `assessments/06-export-toast-wording.md` |
| 10 | Compare-candidates view | `assessments/08-compare-candidates-view.md` |
| 11 | Encryption at rest | `assessments/12-encryption-at-rest.md` |
| 12 | Skills assessed reposition | `assessments/09-skills-assessed-reposition.md` |

## Constraint signal

`candidate_name` stays plaintext even after item 11's encryption work (see `assessments/12-encryption-at-rest.md`). `Candidates::Query` runs `sessions.candidate_name ILIKE ?` for the candidate search feature — Rails' encryption modes support either no equality queries at all or exact-match only, neither of which covers a partial substring search. Encrypting that column needs a blind-index or trigram-based search redesign alongside it, which is its own scoped piece of work, not a variant of this one. Flagging it explicitly rather than leaving it as a silent gap.

## Engineering notes

- **Two duplicate fixes, same bug.** The invite-link bug (row 3) was found once in `CandidateManagement.tsx`, fixed, and then found again in a second file (`AssessmentInvitePage.tsx`) with the identical root cause. Both now share one `buildInviteUrl()` helper instead of each screen reconstructing the link on its own.
- **Defense in depth on consent.** The consent gate isn't just a frontend dialog — the Rails websocket middleware (`audio_websocket_middleware.rb`) independently rejects the interview connection server-side if no consent record exists, so a candidate can't bypass the dialog by hitting the API directly.
- **One purge routine, two callers.** `Session#purge_personal_data!` is called by both the retention Rake task (item 8) and the candidate-initiated deletion endpoint (item 7) — one definition of "what counts as deleted," not two that could quietly drift apart.
- **Config-loading gotcha with ActiveRecord Encryption.** Setting the encryption keys in a normal `config/initializers/*.rb` file silently failed — Rails' own `active_record.encryption` initializer reads those config values earlier in the boot sequence than app-level initializers run, so a later assignment is ignored without error. Had to move the assignment into a `config.before_initialize` hook in `config/application.rb` instead. Documented in `assessments/12-encryption-at-rest.md` since it's the kind of thing that looks like it should work and silently doesn't.
- **AI verification moment.** An early draft of the consent-gate test suite asserted on button text with an empty accessible name (`getByRole("button", { name: "" })`), which happened to pass locally but would have matched the wrong button the moment a second icon-only button existed on the page. Caught in review and replaced with an explicit `aria-label="Copy invite link"` plus a named-role query — a small instance of AI-generated test code that looked correct and would have been a silent false-positive later.
- **Test harness.** RSpec had zero specs and the web app had no test runner at the start of this engagement. Both now run in CI-ready form: 75 RSpec examples, 113 Vitest examples, `tsc --noEmit` clean.
