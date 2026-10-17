# Step 4 — Revamp Strategy: Candidate Consent (UU PDP)

> Case study: Fullstack Product Engineer — AI Interview Platform
> Scope selected from Step 3: **P0-4 (UU PDP non-compliance — consent part)**.
> Rationale: highest legal + fairness impact; fully implementable without a paid Gemini Live key; spans backend + frontend.

---

## 1. Scope Decision

**Problem chosen:** Candidates are recorded (voice = biometric data) and evaluated with no lawful basis — no consent capture, no proof, no way to exercise rights. This is a statutory violation (UU 27/2022) and a product-fairness failure toward the stakeholder who cannot opt out.

**In scope (this revamp):**
- Consent capture flow (backend record + frontend screen) before the interview can start
- Blocking interview start without consent
- Consent proof (timestamp, version, text hash)

**Out of scope (documented, not built here):**
- Encryption of transcripts at rest
- Retention scheduling / auto-deletion
- Audit log of data access
- DSAR (data-subject request) endpoints — including consent revocation **after** the interview has ended (Pasal 8 erasure); this slice handles revocation only **before** the interview starts (AC-14/16/17)
- Structured candidate identity (fixing `candidate_id = null`)
  → all noted in Step 3 as part of P0-4; listed here so reviewers see the boundary.

---

## 2. Self-Derived Acceptance Criteria

Correct behavior per input and edge case, defined **before** code:

| # | Scenario | Expected behavior |
|---|---|---|
| AC-1 | Candidate opens invite link, `consent_status = none` | Sees consent screen with full disclosure (data collected, purpose, retention, recipients incl. Google/Gemini, rights) before any hardware check |
| AC-2 | Candidate accepts consent | `POST /sessions/:token/consent { accepted: true, consent_version }` → 200; proceeds to hardware check; record persisted |
| AC-3 | Candidate declines consent | Sees clear "cannot proceed without consent; no data recorded" message; interview cannot start; no recording happens |
| AC-4 | Candidate reloads page after consent given | Skips consent screen, goes straight to hardware check (consent persisted server-side) |
| AC-5 | Consent already given, POST again | Idempotent — no-op success, no duplicate state change, no error |
| AC-6 | Revoked consent, session not started | Start is blocked; UI explains consent was withdrawn |
| AC-7 | `consent_version` missing/outdated | Server returns current `consent_version` + text; UI renders new text and requires fresh consent |
| AC-8 | Invalid/unknown invite token | `POST consent` → 404 (matches existing `candidate_info`) |
| AC-9 | Session already `ended` | Consent POST → 409 or clear "session unavailable" (no state change) |
| AC-10 | `StartHandler` called without consent (e.g. direct WS) | Refused — session not activated, coverage maps not initialized, error surfaced to WS client |
| AC-11 | Consent text long (multi-paragraph) | Renders readably on mobile and desktop, scrollable, no layout break |
| AC-12 | Assessment language `id` | Consent text rendered in Indonesian; `en` → English |
| AC-13 | Proof record | DB stores `consent_version`, `consented_at`, and hash of the exact consent text shown |
| AC-14 | Candidate revokes consent before interview | `POST /sessions/:token/consent/revoke` → `consent_status = revoked` + `consent_revoked_at`; UI shows "consent withdrawn — interview cannot start, no data processed" |
| AC-15 | Revoke after interview already ended | Out of scope for this slice — that is a DSAR/erasure flow (Pasal 8); returns clear message that a separate data-request path applies |
| AC-16 | Revoke is idempotent | Repeated revoke → no-op, no error, no duplicate state |
| AC-17 | Revoke after grant but before start | Start remains blocked (reuses AC-6); consent screen no longer offers "accept" — shows revoked state |

### Edge cases explicitly handled (brief asks for these)
- **Unassessed skill / missing rating** — out of scope for consent; no interplay (consent gates earlier).
- **Model call failure** — consent does not depend on Gemini; failure paths are only DB/token errors (AC-8/AC-9).
- **Long text** — AC-11.
- **Duplicate/partial writes** — consent POST wrapped in transaction; idempotent (AC-5).
- **Concurrent start** — consent check + activation inside one transaction; no recording without consent.

---

## 3. Solution Options & Trade-offs

### Option A — Consent columns on `sessions` (chosen)
Add `consent_status`, `consent_version`, `consented_at`, `consent_revoked_at`, `consent_text_hash` to `sessions`.

- **Product impact:** Minimal UX surface — one screen before hardware check. High legal value.
- **Cost:** One migration + one endpoint + one frontend screen + tests. Low.
- **Maintainability:** A candidate's consent lives with their session — natural 1:1, no join. Easy to evolve (add columns) or walk back (drop migration).
- **Failure modes:** A session with multiple candidate attempts shares one record (acceptable — one candidate per session). No history of multiple consent changes (add `consent_logs` later if needed).
- **Contextual fit:** Smallest change that satisfies Pasal 20/22/24 proof requirement in this codebase's shape (sessions already carry candidate context).

### Option B — Separate `candidate_consents` table (event log)
A dedicated table with one row per consent event (grant/revoke/version change).

- **Product impact:** Same consent UX; adds future capability (consent history, DSAR audit trail).
- **Cost:** Higher — new table, model, endpoint contract, joins, more tests.
- **Maintainability:** Better audit story long-term; but the app has no candidate identity yet (`candidate_id = null`), so the table would hang off sessions anyway and buy little today.
- **Failure modes:** More moving parts now, with no consumer of the history yet.
- **Contextual fit:** Premature — the audit-trail requirement can be added later without a breaking change.

### Option C — No consent, only a disclaimer screen (rejected)
Show a text notice but record nothing.

- **Cost:** Cheapest by far.
- **Failure:** Fails Pasal 24 ("show proof of consent") and Pasal 22 (recorded consent) — the exact defect we are fixing. Not compliant; rejected on legal grounds.

---

## 4. Chosen Design (Option A)

### Backend
1. **Migration** `add_consent_fields_to_sessions` (reversible):
   - `consent_status` enum: `none | given | revoked` (default `none`, NOT NULL)
   - `consent_version` string (nullable)
   - `consented_at` datetime (nullable)
   - `consent_revoked_at` datetime (nullable)
   - `consent_text_hash` string (nullable)
2. **Model `Session`**: `consent_given?`, `consent_revoked?`, enum helpers; validate version on grant.
3. **Endpoint** `POST /api/v1/sessions/:token/consent` (public, invite-token auth like `candidate_info`):
   - body `{ accepted: true, consent_version }`
   - returns current `consent_version` + text if version mismatch (AC-7)
   - 404 unknown token (AC-8), 409 if session ended (AC-9)
   - persists proof record (AC-13), idempotent (AC-5)
4. **`candidate_info`**: add `consent_status`, `consent_required`, `consent_version`, `consent_text`.
5. **`Sessions::StartHandler`**: refuse activation when `!consent_given?` (AC-10), inside the existing transaction.
6. **Endpoint** `POST /api/v1/sessions/:token/consent/revoke` (public, invite-token auth): sets `consent_status = revoked` + `consent_revoked_at`; idempotent (AC-16); blocked with a DSAR pointer if the session already ended (AC-15).

### Frontend
7. **`types`**: extend `CandidateInfo` with consent fields; add `ConsentRequest` type.
8. **`sessionsApi`**: `requestConsent(token, { accepted, consent_version })` + `revokeConsent(token)`.
9. **`InterviewPage`**: new pre-start state — if `consent_required && consent_status === 'none'`, render `ConsentScreen` (AC-1). Accept → POST + proceed (AC-2); decline → blocked message (AC-3); refresh with consent already given → skip (AC-4). Text from API (AC-7), i18n via assessment language (AC-12).
10. **`ConsentScreen` component** (new): scrollable disclosure, accept/decline buttons, "withdraw consent" action, mobile-safe (AC-11). Withdrawn state → read-only revoked message (AC-17).

### Tests (built with the Step 5 test harness)
- RSpec: model enum/helpers, consent endpoint (accept/decline/404/409/idempotent/version mismatch), `StartHandler` blocks without consent, migration reversibility.
- Web: consent screen render + decline path (once a runner exists).

---

## 5. Trade-offs Accepted

- **Consent history deferred** (Option B) — no history table yet; add `consent_logs` when DSAR/audit work starts. Walk-back cost is low.
- **`candidate_id` stays null** — candidate identity is out of scope; consent attaches to the session, which is the only identity anchor today. Flagged for the follow-up in Step 3.
- **Retention/encryption/DSAR not in this slice** — they are the next layers of P0-4, deliberately split so this slice is shippable, testable, and reviewable on its own.

## 6. Constraint Signal (repeated from Step 3, applies to this revamp)

- Full end-to-end interview verification is blocked by the missing Gemini Live license — this revamp is deliberately chosen to be verifiable without it.
- UU PDP wording/retention specifics need legal sign-off before production; engineering can ship the mechanism, the exact copy needs a product/legal pass.