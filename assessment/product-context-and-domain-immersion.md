# Product Context & Domain Immersion Insights

**Service/Repository**: `ai-interview-platform`  
**Deliverable Type**: Written Analysis & Domain Immersion  
**Target Directory**: `assessment/`  
**Compliance Framework**: UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)  
**Primary References**: [PRD-01](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/PRD-01.md), [PRD-02](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/PRD-02.md), [tech-docs/README.md](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/README.md), [tech-docs/gap-analysis/GAP_ANALYSIS_AGY.md](file:///Users/fahimj/Developer/Learning/ai-interview-platform/tech-docs/gap-analysis/GAP_ANALYSIS_AGY.md)

---

## Executive Summary

Before proposing architectural shifts or writing implementation code, an engineering team must understand the human, industrial, and legal reality inside which software runs. The **AI Interview Platform** is not an abstract coding exercise; it sits directly at the high-stakes intersection of human livelihoods, engineering team velocity, and statutory data privacy in Southeast Asia's largest digital economy.

This document establishes the strategic domain grounding across **5 Core Pillars**:
1. **The Product**: An adaptive, real-time voice-to-voice conversational skills assessor (not an asynchronous video recorder or static quiz).
2. **The Industry**: The structural bottlenecks of talent acquisition in Indonesia (mass volume CV flooding, bootcamp resume inflation, scarce senior engineering bandwidth, and regional pedigree bias).
3. **What It Is For**: Defensible, objective skill evaluations at scale that bridge learning to industry employment while remaining resilient against gaming and model hallucination.
4. **The Users**: The specific daily pressures, workflows, and jobs-to-be-done of Recruiters, Tech Leads, and People Ops Assessors.
5. **The People Affected Who Never Chose It**: The candidate experience, vulnerability, and legal rights under Indonesia's *Undang-Undang Pelindungan Data Pribadi (UU PDP No. 27/2022)*.

---

## 1. Pillar 1: The Product — End to End

> *"Use it end to end before you judge it. Read what it does, not what the code implies it does."*

### 1.1 What It Actually Is (and Is Not)
Superficial inspection of repository code might lead an engineer to assume this is an asynchronous video recorder (like HireVue), a simple LLM chatbot with Text-to-Speech (TTS), or an automated quiz. 

**It is none of those.** The product is an **adaptive, real-time, voice-to-voice conversational skills assessor**. It operates as a live technical dialogue partner powered by Google Gemini Live over WebSockets, ingesting streaming 16kHz linear PCM audio and responding with natural cadence in under 1.5 seconds. It does not grade pre-scripted answers; it actively interrogates specific candidate claims, stress-tests operational trade-offs, detects unprompted competencies, and synthesizes an evidence-backed skill portfolio mapped to strict behavioral anchors.

### 1.2 The 5 Operational Phases

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ 1. Calibration  │ ───► │  2. Onboarding  │ ───► │  3. Live Audio  │ ───► │  4. Portfolio   │ ───► │ 5. Executive Dec│
│  (Assessor T-5) │      │  (Hardware/PDP) │      │ (Dynamic Steer) │      │ (Quote-Backed)  │      │ (Fit/Gap/Human) │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

1. **Setup & Calibration ($T-5$ min)**:
   - The Assessor selects a role profile and configures target competencies from a standardized taxonomy.
   - For each skill, the assessor sets the target level (L1–L5) and defines **behavioral anchors** (observable real-world demonstrations of competence).
   - System Prompt Generator (**N2**) compiles these scopes, exclusions, and anchors into Gemini Live system instructions.
   - An assessment session token is generated with a unique candidate invite link.

2. **Candidate Onboarding & Hardware Check ($T=0:00$)**:
   - The candidate opens the web application link on their browser.
   - A non-punitive hardware check verifies microphone permissions, linear PCM audio input levels (`VoiceBars`), and network latency.
   - The candidate is presented with mandatory statutory **UU PDP affirmative consent disclosures** explaining audio recording, biometric streaming, and evaluation usage.
   - Upon explicit opt-in consent, the client establishes the bidirectional WebSocket connection.

3. **Live Interactive Audio Session ($T=0:02$ to $T=38:00$)**:
   - The browser's `AudioWorkletProcessor` captures raw mic input, converts it to 16kHz linear PCM, and streams audio chunks over WebSockets.
   - Gemini Live streams back synchronized linear PCM audio and real-time transcription turns (`transcript_turns`).
   - The AI acknowledges answers concisely (1–3 sentences) and immediately drills into technical specifics, asking what broke at scale, what metrics were tracked, and why architectural decisions were made.
   - **Resilience Engine**: If network jitter occurs, the backend captures `session_resumption` tokens and transparently reconnects mid-dialogue without terminating or restarting the candidate's interview.

4. **Portfolio Generation ($T=38:45$ to $T=41:00$)**:
   - Once all configured competencies reach `covered` or the session ceiling is reached, **N10 (Gemini Pro)** receives the complete dialogue transcript, the final coverage map, and the calibrated rubrics.
   - It assigns proficiency levels (L1–L5), accompanied by:
     - 2–3 literal candidate quotes demonstrating their reasoning.
     - An objective competency summary highlighting operational ceilings and gaps.
     - A confidence metric (`high`, `medium`, `low`) based on probe depth.

5. **Fit/Gap Analysis & Executive Decision ($T=41:00$ onward)**:
   - The platform executes rule-based matching against vacancy requirements (Match, Gap, Exceed).
   - An LLM narrative synthesizes cultural and engineering alignment drawn strictly from verbatim evidence.
   - The human assessor reviews the portfolio, retains authority to record **overrides** (`assessor_overrides`) with written rationales, and exports the final hiring dossier.

### 1.3 The Closed-Loop Dynamic Steering Engine
The defining technical differentiator of this platform is the closed-loop steering feedback loop:

```
Candidate Speaks Turn
         │
         ▼
Streaming Audio Transcribed to Backend
         │
         ├──────────────────────────────────────────────┐
         ▼ (synchronous)                                ▼ (asynchronous background)
Inject Current Coverage Map                   N7 Coverage Analyzer
via clientContent Turn                        (Gemini Flash Worker)
(Invisible to Candidate)                                │
         │                                    Evaluates rolling dialogue window
         ▼                                    against L1–L5 behavioral anchors
Gemini Live Synthesizes Spoken Follow-up                │
(Sees context + dynamic agenda)                         ▼
         │                                    Updates Skill State:
         ▼                                    not_yet -> initiated -> partial -> covered
Candidate Hears Natural Probing Question                │
                                              Enforces probe_count >= 2
                                                        │
                                                        ▼
                                              Pushes to Real-Time Monitor
```

- **Coverage States**:
  - `not_yet`: Competency untouched; AI is directed to initiate inquiry.
  - `initiated`: Exactly one opening inquiry made. **Hard Platform Rule**: Cannot advance past `initiated` until `probe_count >= 2`.
  - `partial`: Probing is actively underway, but evidence is insufficient to defensibly award an L1–L5 rating with verbatim quotes.
  - `covered`: Sufficient behavioral proof captured. The AI naturally bridges to the next priority competency.
- **Off-Agenda Discovery**: If a candidate unprompted mentions an unconfigured capability (e.g., distributed caching, message queues, team mentorship), the analyzer flags it as a `discovered` skill. The AI probes it for 2–3 turns before bridging back to the configured agenda.

### 1.4 Strict Behavioral Guardrails (What the AI Must NOT Do)
- **No Question-List Mentality**: Never execute a rigid questionnaire. Follow-ups must target the exact trade-offs named in the candidate's prior turn.
- **No Hollow Affirmations**: Phrases like *"Awesome answer!"* or *"Great job!"* are forbidden. The AI remains an objective, courteous technical assessor.
- **No Topic Announcements**: Never state *"Now let's move on to communication skills."* Transitions must be organic conversational bridges.
- **No Skipping Follow-ups**: Moving to a new competency after a single satisfactory answer is prohibited (`probe_count >= 2` strictly enforced).
- **No Long Lecturing**: Prompts must remain short (1–3 sentences max) to maximize candidate speaking time.

---

## 2. Pillar 2: The Industry — Hiring & Talent Assessment in Indonesia

> *"Understand what makes that hard, what is already commoditized, and where the real leverage sits."*

### 2.1 The Indonesian Macro Landscape & Structural Pressures
1. **Massive Volume Asymmetry ("CV Flooding")**:
   - Indonesia's demographic dividend generates hundreds of thousands of entry- and mid-level job seekers annually.
   - A single software engineering posting in Greater Jakarta (*Jabodetabek*), Bandung, or remote across Indonesia routinely receives **1,000 to 3,000+ applicants** within 72 hours on JobStreet, Glints, LinkedIn, and Dealls.
   - Talent Acquisition (TA) teams face acute triage paralysis: 90%+ of screening effort is spent sifting out candidates whose resumes exaggerate competence.
2. **The "Credential Gap" & Resume Inflation**:
   - The explosive growth of regional coding bootcamps, online certifications, and university crash courses has standardized tech buzzwords.
   - Candidates claim proficiency in Docker, Kubernetes, React, and Microservices, but many have only copied boilerplate code. When asked how they resolved a production race condition or managed distributed state, they freeze.
3. **The Senior Engineering Bottleneck**:
   - Experienced engineering leads and senior developers are scarce in Indonesia's tech ecosystem.
   - Diverting senior engineers to conduct 15–20 initial screening calls weekly burns 15+ engineering hours per lead, slows sprint velocity, and inflates hiring costs.
4. **Linguistic Realities (*"Bahasa Jaksel"* & Code-Switching)**:
   - Technical communication in Indonesia is heavily bilingual. Engineers naturally code-switch between Indonesian and English (*"Gue kemarin optimize query-nya tapi kena deadlock di level database"*).
   - An inflexible English-only evaluator introduces artificial friction, while a tool that cannot parse bilingual tech speech fails to assess real capability.
5. **University Pedigree Bias**:
   - Candidates from non-tier-1 regional universities (outside UI, ITB, UGM) face persistent pedigree filtering at the CV stage, even when possessing superior hands-on engineering instincts.

### 2.2 What Is Commoditized vs. Where Real Leverage Sits

| Approach | Industry Status | Why It Fails |
| :--- | :--- | :--- |
| **Resume Keyword Filters (ATS)** | **Commoditized** | Trivially gamed by candidates using generative AI to mirror job descriptions verbatim. High false-positive rate. |
| **Algorithmic Coding Tests (LeetCode/HackerRank)** | **Commoditized** | Measures rote puzzle memorization rather than pragmatic software design; subject to rampant secondary-device cheating and prompt leakage. |
| **One-Way Asynchronous Video Interviews** | **Commoditized** | Candidates record monologues into a camera countdown. Induces severe anxiety, alienates senior talent, and provides zero interactive follow-up. |
| **Adaptive, Interactive Voice Probing** | **Real Leverage** | Challenges claims dynamically—demanding specifics on metrics, edge cases, failure modes, and architectural tradeoffs. Impossible to fake with static scripts. |
| **Pedigree-Agnostic, Quote-Backed Evidence** | **Real Leverage** | Evaluates candidates purely on demonstrated reasoning backed by literal quotes, surfacing hidden regional talent across all Indonesian provinces. |
| **Screening Velocity Compression** | **Real Leverage** | Compresses 3 weeks of calendar tag and low-signal recruiter screening calls into an automated afternoon, freeing engineering leads for final-stage decisions. |

---

## 3. Pillar 3: What It Is For — Outcome, Longevity, and Future Scale

> *"The outcome this product exists to produce, what has to be true for it to keep being useful, and what would make it matter to more people than it reaches today."*

### 3.1 The Core Outcome
The platform exists to produce **objective, high-fidelity, defensible skill evaluations at scale**, establishing a reliable trust bridge between education (bootcamps, universities, self-taught engineers) and employer hiring bars.

### 3.2 What Has to Be True for It to Keep Being Useful
1. **Defensibility Without Hallucination**:
   - Every skill rating in the generated portfolio must be substantiated by 2–3 verbatim candidate quotes.
   - If an engineering manager inspects a summary that misquotes or hallucinates a candidate's answer, institutional trust in the platform collapses immediately.
2. **Anti-Gaming Resilience**:
   - With real-time LLM tools available on candidates' secondary screens, the AI must interrupt rehearsed monologues, pivot to unexpected operational trade-offs, and insist on personal, situational context.
3. **Sub-Second Audio Turnaround**:
   - The end-to-end audio round-trip must remain conversational (<1.5s latency). Any lag breaks dialogue rhythm and creates unnatural cognitive stress.
4. **Human-in-the-Loop Decision Authority**:
   - The platform must function strictly as **decision support**, never an autonomous hiring arbiter. Human assessors must retain full visibility into complete transcripts and the legal authority to log overrides with notes (`assessor_overrides`).

### 3.3 What Will Make It Matter to More People
- **Native Bilingual Engine**: Supporting seamless Bahasa Indonesia and code-switched technical dialogue (`assessments.language` field) so language fluency barriers do not disguise engineering competence.
- **The Candidate's Portable Skill Portfolio**: Transforming the evaluation from an extractive test into a value-generating asset. Even rejected candidates receive an objective diagnostic breakdown (L1–L5 performance + growth recommendations), empowering their job hunt.
- **Low-Bandwidth Resilience**: Optimizing linear PCM streaming over unstable 3G/4G connections, ensuring candidates in remote Indonesian regencies have equal access without audio dropout failures.

---

## 4. Pillar 4: The Users — Assessors, Recruiters, and Hiring Managers

> *"Understand what their day looks like and what they are actually trying to get done."*

### 4.1 Persona Profiles & Jobs-to-be-Done (JTBD)

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│       1. Recruiter / TA         │   │  2. Hiring Manager / Tech Lead  │   │   3. Assessor / People Ops      │
│  "Drowning in 1000s of CVs"     │   │  "Calendar is sacred"           │   │  "Need defensible standards"    │
├─────────────────────────────────┤   ├─────────────────────────────────┤   ├─────────────────────────────────┤
│ • 200+ CVs reviewed daily       │   │ • Sprints, PR reviews, outages  │   │ • Define organization rubrics   │
│ • Chasing interview schedules   │   │ • Hate screening basic trivia   │   │ • Audit interviewer bias        │
│ • Non-technical background      │   │ • Need trade-off & ceiling data │   │ • Defend hires to executives    │
├─────────────────────────────────┤   ├─────────────────────────────────┤   ├─────────────────────────────────┤
│ JTBD: Rapidly triage pipeline   │   │ JTBD: High-signal final rounds  │   │ JTBD: Standardized consistency  │
│ without engineering dependencies│   │ with verified evidence dossiers │   │ and legal compliance audit trail│
└─────────────────────────────────┘   └─────────────────────────────────┘   └─────────────────────────────────┘
```

#### 1. The Recruiter / Talent Acquisition Specialist
- **Their Day**: Sifting through 200+ resumes daily, coordinating complex interview calendars across engineering leads, chasing late interviewer scorecards, and managing candidate drop-off.
- **Their Frustration**: Lacking deep technical knowledge to assess whether a candidate genuinely knows React architecture or merely memorized vocabulary.
- **Platform Transformation**: Automated first-round conversational screening generates instant, verified competency scores, allowing the recruiter to advance the top 5% with confidence in hours instead of weeks.

#### 2. The Hiring Manager / Tech Lead
- **Their Day**: Managing sprint commitments, reviewing pull requests, unblocking team blockers, and responding to production incidents.
- **Their Frustration**: Spending 5 hours a week in screening calls asking basic questions only to realize within 10 minutes that the candidate cannot write production code.
- **Platform Transformation**: Opens a **Fit/Gap Report** displaying exact competency comparisons (e.g., *PostgreSQL: L3 Match, React: L4 Exceed, System Design: L2 Gap*), complete with verbatim quotes detailing how the candidate approached indexing and caching. They enter the final interview ready to explore team alignment and advanced system design.

#### 3. The Assessor / Head of People Ops (e.g., Dimas in PRD-02)
- **Their Day**: Standardizing hiring criteria across departments, training interviewers, auditing hiring fairness, and defending headcount decisions to executives.
- **Their Frustration**: Massive variance between interviewers (one senior engineer is lenient; another asks impossible trivia).
- **Platform Transformation**: Configures uniform L1–L5 behavioral rubrics across all vacancies, monitors active sessions in real time via the live monitor, reviews verbatim quote portfolios, and logs transparent overrides.

---

## 5. Pillar 5: The People Affected Who Never Chose It — Candidates & UU PDP

> *"Candidates are assessed by this product. They do not pick it, they cannot opt out of it, and a wrong result changes a real person's year. Design for them too, keeping Indonesia's Personal Data Protection Law (UU PDP) in mind."*

### 5.1 The Candidate's Reality & Ethical Imperatives
Candidates occupy a position of structural vulnerability:
- **Zero Opt-Out Power**: The candidate did not select this software. An employer mandated it. Declining to interact means immediate forfeiture of the application.
- **High Real-World Stakes**: In Indonesia, securing a software engineering role can transform a family's socioeconomic trajectory. A false negative—whether caused by software glitches, miscalibrated audio thresholds, or algorithmic misinterpretation—costs an individual their livelihood and self-confidence.
- **Psychological Safety in Design**:
  - The AI must maintain an encouraging, respectful, and constructive tone. Hostile or interrogative framing increases test anxiety and distorts true capability.
  - The UI must provide complete transparency: visible time countdown, live audio input feedback (`VoiceBars`), clear connection health indicators, and an explanation of the process.
- **Fault-Tolerant Network Resilience**:
  - Internet instability is a daily reality in Indonesia (ISP drops on Indihome, FirstMedia, mobile 4G tethering).
  - The architecture must support transparent WebSocket session resumption (`session_resumption` tokens). A network drop must resume mid-sentence without losing previous turns, restarting the session, or penalizing the candidate.

---

### 5.2 Legal Compliance: Indonesia's UU PDP (*Undang-Undang No. 27 Tahun 2022*)

*Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi* (UU PDP) imposes strict statutory obligations on the handling of biometric voice data, transcriptions, and algorithmic profiling:

| Article (UU PDP) | Legal Principle | Platform Architectural Requirement |
| :--- | :--- | :--- |
| **Articles 20 & 22** | **Explicit Affirmative Consent** (*Persetujuan Yang Sah*) | • Plain-language Indonesian disclosure of audio streaming, AI transcription, and scoring.<br>• Granular, opt-in consent checkbox before mic activation. No pre-ticked boxes. |
| **Article 10** | **Right to Contest Automated Decisions** (*Hak Menolak Pemrosesan Otomatis*) | • System serves strictly as an evaluation assistant, not an autonomous decider.<br>• Mandatory human assessor review and override capability (`assessor_overrides`). |
| **Article 27** | **Purpose Limitation & Data Minimization** (*Batasan Tujuan & Minimalisasi Data*) | • Candidate data is strictly scoped to the specific vacancy applied for.<br>• Prohibited from being sold or used for unconsented model training.<br>• Ephemeral audio buffers: raw linear PCM audio discarded post-transcription. |
| **Articles 5–11** | **Data Subject Rights** (*Hak Subjek Data*) | • **Access**: Candidates can view their competency breakdown.<br>• **Rectification**: Mechanism to dispute transcription inaccuracies.<br>• **Erasure**: Ability to purge data upon conclusion of recruitment. |
| **Articles 35–39** | **Security & Multi-Tenant Isolation** | • Cryptographic tenant isolation in PostgreSQL (`tenant_id`).<br>• Zero cross-tenant data leakage on portfolios, transcripts, and exports.<br>• Encryption in transit (TLS 1.3 / WSS) and at rest (`pgcrypto`). |

#### Detailed Statutory Safeguards:
1. **Explicit Affirmative Consent (Arts. 20 & 22)**:
   Candidate voice data constitutes **biometric personal data** under UU PDP. Capturing and transmitting audio to third-party cloud APIs (Google Gemini) without explicit, affirmative consent exposes the platform and hiring organizations to administrative sanctions (up to 2% of annual turnover) and criminal penalties under Article 67. The web client must present an unambiguous Indonesian consent gate before the Web AudioWorklet initializes.
2. **Protection Against Purely Automated Profiling (Art. 10)**:
   Article 10 explicitly gives Indonesian citizens the right to object to decisions based solely on automated processing that produce legal or significant effects. **Architectural Enforcement**: The system must *never* execute automated pass/fail decisions. It generates an evaluation portfolio and Fit/Gap report; the human assessor must review evidence and finalize the hiring decision.
3. **Purpose Limitation & Ephemeral Retention (Art. 27)**:
   Personal data collected for vacancy evaluation cannot be reused across other tenants or for generalized model training without renewed consent. Once accurate text turns (`transcript_turns`) are stored, raw streaming audio buffers must be purged to minimize breach blast radius.
4. **Tenant Cryptographic Boundary Enforcement**:
   Every database query across `portfolios`, `coverage_maps`, `transcript_turns`, and `fit_gap_reports` must enforce `tenant_id` scoping at both the middleware and ActiveRecord levels. An authenticated user in Organization A must never be able to access candidate transcripts from Organization B.

---

## 6. Architectural Translation & Domain Model Reference

To ensure engineering changes reflect domain realities, all code in `api/` and `web/` must adhere to these foundational domain entities:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 CORE DOMAIN SCHEMA                              │
├────────────────────────┬────────────────────────────────────────────────────────┤
│ Entity                 │ Domain Role & Business Invariants                      │
├────────────────────────┼────────────────────────────────────────────────────────┤
│ `assessments`          │ Role evaluation template. Scoped to `tenant_id`.        │
│                        │ Fields: `name`, `time_limit_min`, `language`.          │
├────────────────────────┼────────────────────────────────────────────────────────┤
│ `assessment_skills`    │ Target competency with L1–L5 behavioral anchors.        │
│                        │ Fields: `skill_id`, `l1_anchor`..`l5_anchor`,          │
│                        │ `expected_level`, `scope_include`, `scope_exclude`.     │
├────────────────────────┼────────────────────────────────────────────────────────┤
│ `sessions`             │ A live candidate interview instance.                   │
│                        │ Fields: `invite_token`, `status`, `started_at`,        │
│                        │ `gemini_resumption_token`, `end_reason`.               │
├────────────────────────┼────────────────────────────────────────────────────────┤
│ `coverage_maps`        │ Real-time state of competency probing during dialogue. │
│                        │ States: `not_yet`, `initiated`, `partial`, `covered`.  │
│                        │ Invariant: `probe_count >= 2` before `partial/covered`.│
├────────────────────────┼────────────────────────────────────────────────────────┤
│ `transcript_turns`     │ Verbatim dialogue turns (`speaker: ai | candidate`).   │
│                        │ Primary source of truth for portfolio evidence.        │
├────────────────────────┼────────────────────────────────────────────────────────┤
│ `portfolios`           │ Generated evaluation dossier post-session.              │
│                        │ Scoped to `tenant_id` through session association.     │
├────────────────────────┼────────────────────────────────────────────────────────┤
│ `portfolio_skills`     │ Individual competency ratings (L1–L5).                 │
│                        │ Invariant: Must contain 2–3 literal candidate quotes.  │
├────────────────────────┼────────────────────────────────────────────────────────┤
│ `assessor_overrides`   │ Human-in-the-loop corrections to AI ratings.           │
│                        │ Stores `ai_level`, `override_level`, `assessor_notes`. │
├────────────────────────┼────────────────────────────────────────────────────────┤
│ `fit_gap_reports`      │ Vacancy comparison matrix (Match, Gap, Exceed).        │
│                        │ Includes quote-backed culture and alignment narratives.│
└────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 7. Strategic Checklist Before Proposing Code Changes

Before drafting any implementation PR, run every proposal against this domain validation rubric:

- [ ] **End-to-End Voice Fidelity**: Does this change preserve sub-second conversational rhythm and bidirectional streaming audio?
- [ ] **Probe Depth Invariant**: Does the state machine prevent false auto-promotion by strictly enforcing `probe_count >= 2`?
- [ ] **Evidence Grounding**: Does the evaluation logic rely entirely on verbatim candidate quotes, eliminating LLM hallucination?
- [ ] **Candidate Fault Tolerance**: Does a network disruption gracefully resume via `session_resumption` without resetting progress?
- [ ] **UU PDP Consent Compliance**: Is explicit affirmative consent verified before audio hardware streams data?
- [ ] **Multi-Tenant Scoping**: Is every API endpoint and query strictly scoped to `tenant_id` to prevent cross-organization leakage?
- [ ] **Human Authority Preserved**: Does the feature reinforce the human assessor's oversight and override capability rather than making autonomous decisions?
