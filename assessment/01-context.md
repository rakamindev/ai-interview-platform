# Step 2 — Context & Domain Immersion

## 1. The product (what it actually does)

An AI voice interviewer for skills assessment:

1. **Assessor** configures an *assessment* (skills + L1–L5 behavioural anchors, time limit, language) and invites a candidate by link.
2. **Candidate** talks to a Gemini Live voice agent. A coverage engine tracks which skills have been probed (`not_yet → initiated → partial → covered`).
3. After the session, a **portfolio** is generated (Gemini Pro): per skill an AI level (1–5), a confidence (high/medium/low), up to 3 evidence quotes and a competency summary.
4. The assessor can **override** an AI level with notes (human-in-the-loop).
5. The assessor runs a **Fit/Gap report** against a *vacancy* (expected level per skill): rule-based comparison + an LLM narrative, exportable to PDF/JSON.

The Fit/Gap report is the artefact that leaves the assessor's desk and reaches a hiring manager. It is the *decision surface* of the product.

## 2. The industry — hiring & assessment in Indonesia

- **Volume vs. capacity.** Entry/mid-level roles routinely receive hundreds of applicants per opening; HR teams are small and screening is the bottleneck. Phone screens and first-round interviews are what get skipped or rushed.
- **Commoditised:** ATS/job posting, CV parsing, psychometric and cognitive tests, generic video interview recording. Competing on those is a race to the bottom.
- **Where the leverage is:** structured, *evidence-backed*, comparable judgement of actual skill — produced at the cost of a screening call. A structured interview with anchored rubrics is one of the most valid selection methods; the product automates the structure.
- **What makes it hard:** language mix (Bahasa Indonesia / English / code-switching), connectivity on mobile, inconsistent rubric use between assessors, and low trust in "black box" AI scores from both HR and candidates.

## 3. What it is for

**Outcome:** a hiring manager can make a faster *and fairer* next-step decision (advance / probe further / decline) from a 30–45 minute AI interview, without re-interviewing to find out what the candidate can do.

What has to stay true for it to remain useful:

- **Trust in every number.** One visibly wrong row (e.g. a blank "Required" column, an override that silently vanishes) and the assessor stops trusting all rows, and goes back to manual interviews.
- **Honesty about uncertainty.** "Not assessed" and "low confidence" must look different from "gap". Missing evidence is not negative evidence.
- **Human authority.** Assessor overrides must win, must be visible, and must survive regeneration.

What would make it matter to more people: reports a hiring manager can forward without an assessor translating them, and candidates being able to get a fair, explainable outcome (which in turn makes the product defensible to enterprise clients' legal teams).

## 4. The users

| User | Their day | What they need from the Fit/Gap screen |
|---|---|---|
| **Assessor** (HR/TA specialist, sometimes a senior engineer) | Juggles dozens of candidates across roles; reviews portfolios in between meetings | See instantly which rows are AI vs. their own correction; know if a report is outdated after they edited something; never wait on an infinite spinner |
| **Recruiter** | Moves candidates through pipeline stages, communicates with them | A defensible one-glance summary: matches / gaps / exceeds / *not assessed*; an export they can attach |
| **Hiring manager** | Little time, reads the report on a phone between meetings | Required vs. candidate level side by side, what to probe in the next round, explicit caveats |

## 5. The people affected who never chose it — candidates

- Candidates cannot opt out of the tool and rarely see the output. A false "gap" can cost them the job.
- Failure modes that harm them directly:
  - A skill the AI never probed (time ran out, connection dropped) shown as missing ability.
  - A gap derived from one weak probe (low confidence) treated as final.
  - An LLM-written "hiring recommendation" read as the decision.
  - Their data visible to another tenant (company).

### UU PDP (Law No. 27/2022) implications for this slice

| UU PDP principle | Implication for Fit/Gap |
|---|---|
| Purpose limitation & data minimisation | Report contains only skill levels/evidence needed for the role; logs carry IDs, never names, quotes or transcripts |
| Accuracy (right to correction) | Assessor overrides are the correction mechanism — they must persist and be shown as such |
| Automated decision-making (right to object to decisions based solely on automated processing) | The narrative is framed as an AI-generated draft and "areas to probe", never as a hire/no-hire recommendation; a human sign-off is explicit |
| Confidentiality / security | Strict tenant isolation on every portfolio, override and report endpoint (and in background workers) |
| Accountability | Each report records when it was generated, from which inputs (digest) and whether the narrative is AI or deterministic fallback |

## Assumptions (no live Q&A available)

1. The Fit/Gap report is the primary artefact consumed by hiring managers (supported by PRD-02, Phase 5).
2. Tenant = organization (`sessions.tenant_id`); portfolios and reports inherit tenancy from their session.
3. Levels are integers 1–5 everywhere (DB check constraints confirm).
4. Report deliverables are written in English to match the brief.
