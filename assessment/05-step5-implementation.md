# Step 5 — Monozukuri Implementation Report

> Case study: Fullstack Product Engineer — AI Interview Platform
> Feature: Candidate consent (UU PDP, Step 3 P0-4) + test harness (Step 3 P0-3 foundation).

---

## 1. What Was Shipped

**Feature (consent):**
- `sessions.consent_status / consent_version / consented_at / consent_revoked_at / consent_text_hash` (migration, reversible)
- `Session#grant_consent!` / `#revoke_consent!` — explicit consent proof, idempotent, refuses on ended sessions
- `POST /sessions/:token/consent` + `POST /sessions/:token/consent/revoke` (invite-token only)
- `GET /sessions/:token/candidate` now returns consent metadata + localized notice (EN/ID)
- `Sessions::StartHandler` raises `ConsentRequired` — WS surfaces `consent_required` error, session never activates without consent
- `ConsentScreen` component + `InterviewPage` gate (accept / withdraw / revoked state)

**Test harness (foundation):**
- RSpec 6 suite: `spec/models`, `spec/requests`, `spec/services` — 20 examples, 0 failures
- Web: Vitest + Testing Library — `ConsentScreen.test.tsx`, 6 tests, 0 failures
- CI: `.github/workflows/ci.yml` — API (RSpec + Postgres/Redis services) + Web (Vitest + tsc)

## 2. Proven Correctness

- RSpec: 20 examples, 0 failures (`bundle exec rspec`)
- Vitest: 6 tests, 0 failures (`npm run test`)
- Type-check: `tsc --noEmit` → no errors

## 3. Designed Failure Paths

| Failure | Handling |
|---|---|
| Consent version out of date | 422 with current version; UI can re-fetch notice |
| Session already ended | 409 on grant/revoke — DSAR path pointer |
| Unknown token | 404 (matches existing candidate_info contract) |
| Repeated grant / revoke | Idempotent — no state churn, original timestamps kept |
| Start without consent (direct WS) | `ConsentRequired` → `consent_required` error frame → WS closed, session stays `pending` |
| Network/API error on consent POST | Frontend shows error, buttons re-enabled |
| Consent revoked then page refreshed | `candidate_info` returns `consent_status=revoked`; UI renders the withdrawn screen instead of the hardware check — start is unreachable (found during manual test after revoke, fixed, covered) |

## 4. Seeded Fault Test (proven the tests are real)

On the feature branch I seeded a fault: changed `grant_consent!` to persist `consent_status: 'none'` instead of `'given'`.

```
$ bundle exec rspec spec/models/session_spec.rb spec/requests/consent_spec.rb
17 examples, 3 failures
- Session consent #grant_consent! marks consent as given with proof fields
- POST /sessions/:token/consent records explicit consent
- POST /sessions/:token/consent is idempotent on repeated grant
```

Reverted the fault → `20 examples, 0 failures`. The suite catches the regression.

## 5. AI Verification Moments

1. **"Just change the model" was wrong.** During P0-2 investigation the initial hypothesis (mine, AI-generated) was that swapping the deprecated `gemini-2.0-flash-live-001` to a newer live model would fix the interview. Direct verification against the Gemini API showed otherwise: all three provided keys lack Gemini Live access (bidiGenerateContent never returns setupComplete). I did not trust the assumption — I tested it, and corrected the conclusion. The config was still updated to `gemini-3.8-live` (valid), but the real blocker (licensing) was correctly separated.

2. **`json_error` misuse caught by tests.** The first consent-version-mismatch implementation passed a hash as the error `message`; `json_error` renders it as a nested object, which broke the response shape. The RSpec request spec failed on the assertion, forcing a fix to a plain-string message. The harness caught an AI-written defect before it shipped.

3. **"l1 anchor missing" misdiagnosis.** Early in exploration I reported a "defined but broken" bug where custom-skill submission failed with `l1 anchor can't be blank`. Re-reading `CustomSkillForm` proved the form already captures L1–L5; the real issue was my test payload, not the app. I verified against the actual component and corrected the claim before it entered Step 3.

## 6. Protected Data (UU PDP)

- Consent proof persisted (version, timestamp, notice hash) — Pasal 20/22/24
- Revocation honored before interview start — Pasal 9
- No personal data in logs; notice discloses cross-border processing (Gemini) — Pasal 56
- Out of scope this slice (documented in Step 4): encryption at rest, retention, DSAR, audit log, candidate identity

## 7. PR Structure

Planned: a single feature branch (`feature/case-study-assessment`) with small commits:
1. migration → 2. model → 3. endpoints → 4. StartHandler → 5. web types/api → 6. ConsentScreen → 7. InterviewPage gate → 8. RSpec → 9. web tests → 10. CI → 11. this report.

(PR creation held pending author review — not yet pushed.)