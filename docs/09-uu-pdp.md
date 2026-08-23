# 09 — UU PDP Compliance

**Provenance: `[BRIEF]` + `[CODE]`.**

Indonesia's Personal Data Protection Law (UU PDP, Law 27/2022). Article 10 analysis for automated hiring decisions.

---

## 1. What Is UU PDP

UU PDP (Undang-Undang Pelindungan Data Pribadi) is Indonesia's comprehensive data protection law, enacted 17 October 2022, with a 2-year transition period ending 17 October 2024.

Key principles:
- Consent required for data processing
- Purpose limitation (data used only for stated purpose)
- Data minimisation (collect only what is needed)
- Right to access, correct, and delete
- Right to object to automated decision-making (Article 10)

---

## 2. Article 10 — Automated Decision-Making

> "Every person has the right to not be subject to a decision based solely on automated processing, including profiling, which produces legal effects or similarly significantly affects that person."

### Does this platform trigger Art. 10?

**Yes.** A hiring rating is a textbook case:

1. **Automated processing**: Gemini AI assigns skill levels (L1-L5) based on interview transcript
2. **Significant effect**: The rating is used in hiring decisions (hire/no-hire)
3. **Sole basis**: Without human override, the AI rating is the sole assessment

### How the override system satisfies Art. 10

The `AssessorOverride` model (`api/app/models/assessor_override.rb:3-11`) provides:

```ruby
class AssessorOverride < ApplicationRecord
  include TenantScoped
  belongs_to :portfolio_skill
  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :assessor_notes, presence: true
  validates :overridden_by,  presence: true
end
```

A human assessor:
1. Reviews the AI-generated rating
2. Provides their own rating (`override_level`)
3. Records why (`assessor_notes`)
4. Is identified (`overridden_by`)

**The override breaks the "solely on automated processing" chain.** The final rating is human-determined.

### What's missing for full compliance

| Requirement | Status | Gap |
|------------|--------|-----|
| Human-in-the-loop | Partially met | Override exists but is erasable (P0-12, now fixed) |
| Audit trail | Partially met | `assessor_override_events` now exist (P0-13, now fixed) |
| Candidate notification | Not met | No consent flow, no notification of AI use |
| Right to contest | Not met | No mechanism for candidate to challenge a rating |
| Right to access | Not met | Candidate cannot see their own portfolio |
| Data retention policy | Not met | No retention/deletion schedule |

---

## 3. Data Inventory

### Personal Data Processed

| Data Type | Storage | Purpose | Retention |
|-----------|---------|---------|-----------|
| Candidate name | `sessions.candidate_name` | Display in portfolio | Until deleted |
| Candidate email | Not stored (JWT-based) | Authentication | Session-only |
| Interview transcript | `transcript_turns.text` | Evidence for skill assessment | Until deleted |
| Audio (live) | Streamed, **never persisted** | Real-time interview | Ephemeral |
| Skill ratings | `portfolio_skills.ai_level` | Hiring decision evidence | Until deleted |
| Evidence quotes | `portfolio_skills.evidence` | Verbatim candidate statements | Until deleted |
| Override notes | `assessor_overrides.assessor_notes` | Human review justification | Until deleted |

### What is NOT stored (by design)

- Candidate audio (streamed, not persisted)
- Candidate IP address
- Browser fingerprint
- Recording of the interview
- Candidate photo

### Logging discipline

All application logs use IDs and buffer lengths, never:
- Speech content
- Candidate names
- API tokens
- Personal identifiers

---

## 4. The Override as Legal Shield

Without the override system, every rating in the platform would be:
1. Solely automated
2. With significant effect (hiring decision)
3. Without human review

That triggers Art. 10 in full. The candidate could:
- Object to the rating
- Demand human review
- Claim damages for automated discrimination

With the override system:
1. A human reviews each rating
2. The human records their judgement
3. The judgement is auditable

**But only if the override survives and is auditable.** That is why:
- P0-12 (override deletion) was fixed in the first code wave
- P0-13 (audit trail) was added as a new table
- The override is marked `assessor_notes: presence: true` — a reason is required

---

## 5. Recommendations for Full Compliance

1. **Add candidate consent flow** — inform candidates that AI will be used in assessment
2. **Add candidate access** — let candidates view their own portfolio
3. **Add contest mechanism** — let candidates challenge a rating
4. **Add retention policy** — define how long data is kept
5. **Add data export** — let candidates export their data (right to portability)
6. **Document legal basis** — Art. 6(1)(f) legitimate interest or Art. 6(1)(a) consent

---

## 6. One Thing Already Done Right

**Candidate audio is never persisted.** The WebSocket streams audio to Gemini Live for real-time transcription, but the raw audio is never stored. This means:

- No voice recording to secure
- No biometric data to classify
- No audio to breach

Logging is disciplined: `audio_buffer_length: 1024`, never speech content.
