# Pull Request: Candidate Reliability, Compliance & Portfolio Revamp

Branch: `feature/hadist-improvement` → `main`

## Summary

Fixes a verdict data-integrity bug, removes a duplicated frontend/backend logic path, closes UU PDP gaps (consent, data subject rights, retention, encryption at rest), fixes a two-file invite-link bug, hardens a silent transcript-capture failure found live during testing, and revamps the candidate-facing views.

Every change has RSpec and/or Vitest coverage, a migration where the schema changed, and a seeded-fault proof: break the check on purpose, watch it fail, revert.

## What's in this branch

| Severity | Count | Definition |
|---|---|---|
| P0 | 4 | Breaks a core workflow, a compliance requirement, or shows wrong data to a decision-maker |
| P1 | 6 | Real workflow/maintainability impact, not yet broken in production |
| P2 | 4 | Moderate UX or code-health improvement |
| P3 | 2 | Cosmetic polish |
| **Total** | **16** | |

## Improvements

| # | Improvement | Fixed/Adds | Sev | Doc |
|---|---|---|---|---|
| 1 | Candidate consent before interview start (UU PDP) | Adds | P0 | [01](assessments/01-candidate-consent-uu-pdp.md) |
| 2 | Verdict backfill for portfolios predating the verdict feature | Fixed | P0 | [02](assessments/02-portfolio-verdict-backfill.md) |
| 3 | Invite link pointed at API host instead of web app | Fixed | P0 | [03](assessments/03-invite-link-wrong-origin.md) |
| 4 | Verdict summary computed twice — server enum, client prose | Fixed | P1 | [04](assessments/04-verdict-summary-server-side.md) |
| 5 | Candidate export collapsed "not found" and "failed" into one status | Fixed | P1 | [05](assessments/05-candidate-export-status-classification.md) |
| 6 | Portfolio page broke on zero-skill interviews | Fixed | P1 | [07](assessments/07-zero-skills-empty-state.md) |
| 7 | Candidate self-service data access/deletion (UU PDP) | Adds | P1 | [10](assessments/10-candidate-data-subject-rights.md) |
| 8 | Retention/expiry policy for candidate data (UU PDP) | Adds | P1 | [11](assessments/11-retention-policy.md) |
| 9 | Export toast was one unreadable run-on paragraph | Fixed | P2 | [06](assessments/06-export-toast-wording.md) |
| 10 | No side-by-side candidate comparison view | Adds | P2 | [08](assessments/08-compare-candidates-view.md) |
| 11 | Encryption at rest for transcript text (UU PDP) | Adds | P2 | [12](assessments/12-encryption-at-rest.md) |
| 12 | "Skills assessed" list disconnected at page bottom | Fixed | P3 | [09](assessments/09-skills-assessed-reposition.md) |
| 13 | Transcript-save failures silently swallowed | Fixed | P0 | [13](assessments/13-silent-transcript-capture-failure.md) |
| 14 | Interview-complete and "Your data" views had no visual hierarchy | Fixed | P3 | [14](assessments/14-candidate-facing-view-revamp.md) |

## Known gap

`candidate_name` stays plaintext. `Candidates::Query` runs `ILIKE` search on it, and Rails encryption only supports no-search or exact-match, not substring. Encrypting it needs a blind-index or trigram redesign — scoped separately, not silently dropped. See [12](assessments/12-encryption-at-rest.md).

## Notes

- **Row 3, twice.** Same invite-link bug hit two files (`CandidateManagement.tsx`, `AssessmentInvitePage.tsx`). Both now call one `buildInviteUrl()` helper instead of reconstructing the link separately.
- **Consent enforced twice.** The websocket middleware rejects a session server-side with no consent record, not just the frontend dialog — a candidate can't skip it by hitting the API directly.
- **One purge routine.** `Session#purge_personal_data!` backs both the retention rake task and the candidate delete endpoint, so "deleted" means one thing.
- **Encryption config gotcha.** Keys set in a normal initializer are silently ignored — Rails reads `active_record.encryption` config earlier in boot. Fix: `config.before_initialize` in `application.rb`. Detailed in [12](assessments/12-encryption-at-rest.md).
- **That gotcha found a real bug.** A stale Puma process pre-dating the encryption keys raised a config error on every transcript save for 3 live sessions, 24 turns lost, silently logged and ignored. Restarted the server, then hardened the swallow itself (row 13) so the next failure mode won't hide the same way.
- **Caught an AI test bug.** An early consent test matched a button by empty accessible name — passed by luck, would've broken the moment a second icon-only button existed. Replaced with `aria-label="Copy invite link"` and a named query.
- **Test harness built from zero.** No RSpec, no web test runner at start. Now: 81 RSpec examples, 117 Vitest examples, `tsc --noEmit` clean.
