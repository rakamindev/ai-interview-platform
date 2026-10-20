# 01 · Product Context

> Brief Step 2. Built from using the product end to end (two live interview sessions on 2026-10-20), reading both services, and inspecting database records and API payloads. Where the code and the README disagree, this document follows the code.

## 1. The product: what it actually does

An AI voice interviewer for skill assessment. The real flow, as observed:

| Step | Actor | What happens |
|---|---|---|
| 1. Configure | Assessor | Creates an **assessment** (name, time limit 10–90 min, language EN/ID, 1+ skills with L1–L5 anchor descriptions) and a **vacancy** (role, expected level per skill, culture notes). |
| 2. Invite | Assessor | Creates a **session**; gets a link with a 256-bit invite token. |
| 3. Interview | Candidate | Passes a hardware/network check, then talks to a Gemini Live voice agent. Each candidate answer triggers a **coverage** analysis (Gemini Flash) that moves each skill through `not_yet → initiated → partial → covered`; the agent uses that map to decide what to probe next. |
| 4. Monitor | Assessor | Watches coverage and the transcript live. |
| 5. Portfolio | System | When the session ends, Gemini rates **every** skill L1–L5 with confidence, evidence quotes and a summary. |
| 6. Fit/Gap | System → Recruiter | Compares the portfolio against a vacancy: `match / gap / exceed / not_assessed` per skill, plus an AI-written **hiring recommendation** and culture narrative. |
| 7. Override & export | Assessor | Can override a skill's level; exports PDF/JSON. |

**What it is for, in one line:** turn a 10–60 minute conversation into *evidence* a hiring team can trust enough to decide who moves forward.

## 2. The industry: hiring and talent assessment in Indonesia

- **Volume vs. attention.** Early-stage screening is high-volume and repetitive; assessor time is the scarce resource. Structured, async, AI-run first rounds are where the leverage is — this is exactly what the product targets.
- **What is commoditized:** job boards, ATS pipelines, generic aptitude tests, and increasingly "AI interview" transcription and summarization.
- **Where the real leverage sits:** *trustworthy* evaluation. A summary is cheap; a rating a hiring manager is willing to act on — and defend — is not. Trust is the product; once a recruiter catches the tool scoring something it never measured, they stop relying on every score it produces.
- **Local realities that shape the design:**
  - Candidates interview on consumer mobile/home connections with modest upload bandwidth (observed: our own walkthrough was blocked by the network check on a ~14 Mbps upload — see F-007).
  - Interviews may run in English or Bahasa Indonesia, and many candidates are interviewing in a second language. Hesitation and fragmented speech must not be confused with lack of skill.
  - **UU No. 27/2022 on Personal Data Protection (UU PDP)** is now enforceable and directly governs automated evaluation of people (see §5).

## 3. What has to be true for it to stay useful

1. **A rating means evidence was observed.** If the interview never touched a skill, the system must say *not assessed*, not invent a level.
2. **Uncertainty is visible and propagates.** Low confidence, partial interviews, and model failures must reach the screen, the PDF and the recommendation — not be flattened into a confident verdict.
3. **Screen, API and PDF agree.** The recruiter, the hiring manager reading the PDF, and any downstream ATS must see the same truth.
4. **Failures are explicit and recoverable.** Model timeouts, quota limits, and partial writes happen (we hit all of them in two sessions); the system must surface them and allow safe retry.
5. **Humans stay in control.** Assessor overrides must be respected everywhere and never silently lost.

**What would make it matter to more people:** assessors who trust it enough to skip the manual first round, and candidates who experience it as fair — which is the condition for using it at volume.

## 4. The users

| User | Their day | What they are actually trying to get done | What the product must give them |
|---|---|---|---|
| **Assessor** (technical interviewer) | Many interviews competing with their own engineering work. | Decide quickly whether a candidate's skill claims hold up. | Evidence per skill, an honest "not enough signal" when there isn't any, and a quick override. |
| **Recruiter** | Runs many pipelines; owns candidate communication. | Shortlist and explain decisions to hiring managers and candidates. | A fit/gap view they can read in 30 seconds and defend; a PDF that matches the screen. |
| **Hiring manager** | Reviews shortlists, makes the call. | Confidence that a "gap" is a real gap. | A recommendation that states its own confidence and what was *not* covered. |

## 5. The people affected who never chose it: candidates

Candidates do not choose this tool and cannot opt out of it; a wrong rating changes someone's year. Observed today:

- A candidate who **ended the interview after 3 min 19 s** (5 answers, one "I don't know") received **L1 on two skills** and a written **"we do not recommend proceeding with this candidate"** — the skill the AI itself described as "not discussed in detail" was still scored L1. Low confidence was present in the data and ignored by the verdict.
- A culture narrative stated *"soft skills were not explicitly evaluated"* and in the same paragraph predicted the candidate *"may struggle to establish credibility."*
- The network check blocked a working connection with no way to continue (F-007), and every failure path ends on a screen saying *"Interview Complete — the interview has been recorded"* (F-010).
- There is no notice before recording that the voice is recorded, transcribed, sent to Google Gemini, and scored by AI.

### UU PDP implications

| Obligation (UU 27/2022) | Why it applies here | Current state |
|---|---|---|
| **Right to object to decisions based solely on automated processing, including profiling** (Art. 10) | Skill levels, fit/gap results and the hiring recommendation are AI-generated profiles with significant effect. | Assessor override exists (partial mitigation) but candidates are never told automated scoring occurs. |
| **Accuracy of personal data** (controller's accuracy obligation) | A fabricated L1 for an unassessed skill is inaccurate personal data about a real person. | **Violated by design** — the schema cannot represent "not assessed" (F-001). |
| **Lawful basis / explicit consent, and notice of purpose** | Voice recording, transcription and AI evaluation. | No consent or notice anywhere in the candidate flow (F-014). |
| **Impact assessment for high-risk processing** (automated decision-making, large-scale) | Applies to this product category. | None found. |
| **Cross-border transfer** (Art. 56) | Candidate voice and transcripts are processed by Google Gemini outside Indonesia. | Not disclosed. |
| **Security of processing; minimization** | Transcript fragments are logged at INFO in production; request parameters are not filtered. | F-015. |
| **Retention and erasure** | Interview data about non-hired candidates. | No retention policy or deletion path (F-014). |

*Article references are to UU No. 27/2022; exact article numbers for the accuracy, consent and impact-assessment obligations should be verified against the official text before citing them externally.*

## 6. The core problem

> **The product turns absence of evidence into evidence of absence.**
>
> When the interview produces no signal about a skill — because it was never asked, the candidate deflected, the session ended early, or the coverage model failed — the system still records a level (L1), compares it against the vacancy as a **gap**, and writes a confident **"do not recommend."** The uncertainty exists in the data (`confidence: low`, coverage `not_yet`) but is discarded at every seam: the scoring prompt forces a level, the parser clamps anything unreadable to L1, the database rejects NULL, the fit/gap engine ignores confidence, and the report screen cannot even show the required level. The people harmed are the candidate, who is scored on questions nobody asked, and the hiring team, who cannot tell a real gap from a missing measurement.

This is the gap the revamp targets (see `03-strategy.md`). Everything else found is ranked in `02-findings.md`.
