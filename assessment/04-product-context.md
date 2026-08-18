# Product and Domain Context

- **Platform:** AI Interview Platform
- **Branch:** `assessment/trustworthy-results`
- **Scope:** Multi-Tenant Voice Assessment, Trustworthy Evaluation, and Candidate Data Governance

---

## 1. User Personas and Workflow Goals

| Persona | Primary Workflow Goals | Key Decisions Supported |
|---|---|---|
| **Recruiter** | Configure assessments, invite candidates, track completion status, match portfolios against vacancies (Fit/Gap analysis). | Candidate screening progression, interview shortlisting, role alignment. |
| **Assessor** | Monitor live interviews, review AI-generated skill evaluations and evidence quotes, calibrate/override ratings with human justification. | Competency verification, rating calibration, qualitative assessment sign-off. |
| **Hiring Manager** | Review exported PDF/JSON skill portfolios, compare candidate levels against job expectations, evaluate fit/gap narratives. | Final interview selection, hiring decisions, compensation leveling, onboarding focus areas. |
| **Candidate** | Receive interview invitation link, perform hardware check, complete voice interview with AI interviewer. | Non-consenting subject of evaluation; expects fairness, confidentiality, and data protection. |

---

## 2. Decision Needs of Hiring Managers

Hiring managers require accurate, defensible, and granular competency assessments. Their decisions depend on:
1. **Verifiable Behavioral Evidence:** Quotes extracted directly from candidate dialogue demonstrating problem-solving depth, not just theoretical recall.
2. **True Signal vs. Absence of Signal:** Clear distinction between demonstrated foundational ability (L1), an unassessed area, and an ongoing or failed evaluation.
3. **Calibrated Human Overrides:** Visibility into whether an L-rating originated from automated AI analysis or an assessor's calibrated override (with explanatory notes).

---

## 3. Candidate and Business Impact of Failure Modes

```
Failure Mode                           Candidate Impact                           Business / Decision Impact
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Cross-Tenant Access                     Confidentiality breach; private evaluation  Enterprise trust collapse; severe
                                        data exposed to competing organizations.   liability under privacy regulations.

Unassessed Skill Coerced to L1          Unfair penalty; branded as low-performing   False negative filter; qualified
                                        for topics never discussed in interview.   candidates rejected erroneously.

Portfolio Destroyed on Regeneration     Loss of historical evaluation data;        Recruiter workflow stalled; unable
                                        candidate left in unrated state.           to make hiring decisions.

Incomplete / Unavailable Evidence       Candidate evaluated on arbitrary score     Hiring manager cannot defend hiring
                                        without supporting interview quotes.       decisions during calibration.
```

---

## 4. Semantic Distinction: "Not Assessed", "Generation Failed", and "Level 1"

Conflating these three states corrupts the integrity of hiring decisions:

- **Level 1 (Foundational / L1):** The candidate *actively discussed* the skill and demonstrated only basic/theoretical knowledge requiring close supervision. This is a valid, evidence-backed evaluation score.
- **Not Assessed (`not_assessed`):** The skill was never probed or discussed during the interview (e.g. time ran out, topic not reached). It represents an *absence of data*, not an assessment of low competence.
- **Generation Failed (`failed`):** The interview occurred, but the post-processing model failed (malformed JSON, rate limit, timeout). The previous valid evaluation must be preserved, and the recruiter must be given clear retry options.

---

## 5. Trust Boundaries and Data Flow

```
[Candidate Browser (Untrusted)]
       │ (Invite Token only)
═══════╪═════════════════════════════════════════════════════════════════════════════════════ Trust Boundary 1 (Public / Candidate)
       ▼
[AudioWebSocket / Candidate API]
       │
═══════╪═════════════════════════════════════════════════════════════════════════════════════ Trust Boundary 2 (Tenant Segregation)
       │ (Current.tenant_id enforced via JWT scheme)
[Rails Controllers & Models (Tenant-Scoped)]
       │
═══════╪═════════════════════════════════════════════════════════════════════════════════════ Trust Boundary 3 (Asynchronous Workers)
       │ (Job params: session_id; must inherit or re-establish tenant context)
[Sidekiq Workers (Coverage / Portfolio / FitGap)]
       │
═══════╪═════════════════════════════════════════════════════════════════════════════════════ Trust Boundary 4 (External AI Services)
       │ (Gemini API: Sends prompts, receives untrusted raw model responses)
[Gemini Live & REST APIs]
```

---

## 6. Privacy and Data Governance

1. **Candidate Audio & Transcripts:** Biometric and conversational data recorded during sessions. Must remain isolated within the tenant and accessible only to authorized assessors.
2. **AI Output & Competency Summaries:** Derived data based on candidate performance. Must be stored accurately and never exposed cross-tenant.
3. **Assessor Notes:** Confidential internal evaluation rationale.
4. **Exported Reports (PDF/JSON):** Consolidated evaluation assets that must strictly inherit tenant ownership and authorization checks.

---

## 7. Relevant Data Protection Considerations (UU PDP No. 27/2022)

Without drawing unsupported legal conclusions, technical design must align with key data protection principles under Indonesian law:
- **Article 16 (Fairness and Transparency):** Processing must be conducted fairly and transparently with clear notice regarding evaluation purpose.
- **Articles 20–22 (Lawful Basis & Information):** Candidates must be informed of the nature of processing and automated assessment mechanisms.
- **Article 35 (Technical Safeguards):** Data controllers must implement technical measures to prevent unauthorized data access, leakage, or cross-organization disclosure.

---

## 8. Assumptions Requiring Product or Legal Confirmation

1. **Assessor Override Policy:** Can an assessor provide an override for a skill that was `not_assessed`, or must overrides only apply to skills with AI evaluation? *(Assumed: Overrides apply only to assessed skills unless explicit manual rating is configured).*
2. **Data Retention & Candidate Access:** Does the candidate have direct portal access to view their transcript post-interview? *(Assumed: Candidate sees completion screen only; transcript is assessor-facing).*
