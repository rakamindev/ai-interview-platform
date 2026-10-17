# Step 2 — Deep Context & Domain Immersion

> Case study: Fullstack Product Engineer — AI Interview Platform
> Document: context notes for the final report (product/domain/people).

---

## 1. The Product — What It Actually Does

AI Interview Platform = **voice-based AI skills assessor**. Assessor configures a role + skills (L1–L5 behavioral anchors), mints a candidate invite link, candidate talks to Gemini Live AI over audio WebSocket, backend tracks skill coverage live, and at the end generates an L1–L5 **skill portfolio** + **fit/gap report** against a vacancy, exportable to PDF.

Full pipeline (from codebase audit + PRD):

| Phase | Who | What |
|---|---|---|
| Configure | Assessor | Create assessment: role title, time limit, language, skills (B7 taxonomy or custom) with expected level |
| Invite | Assessor | Create session → invite link `/interview/:token` sent to candidate |
| Hardware check | Candidate | OS/browser, internet speed, mic level, audio output (+camera optional) |
| Live interview | Candidate ↔ AI | PCM audio WebSocket ↔ Gemini Live; AI probes each skill; coverage map injected before each AI turn |
| Coverage scoring | Backend async | Gemini Flash analyzes last 6 turns → state transitions not_yet→initiated→partial→covered (probe_count ≥ 2 hard gate) |
| Portfolio | Backend async | Gemini Pro rates L1–L5 + confidence + evidence quotes + competency summary |
| Fit/Gap | Backend | Rule-based level delta vs vacancy + Gemini Flash culture narrative |
| Review/export | Assessor | Portfolio, transcript, fit/gap report, PDF/JSON export, **assessor override** of AI level |

Tech: Rails 7 API (Postgres, Redis/Sidekiq, Gemini REST + Live WS), React 18 + TS web (Vite, Tailwind, Radix, Jotai, RHF). Multi-tenant via JWT `scheme` claim + Apartment-style schema scoping.

### Findings from walking the product (Step 1 exploration)

- Health, assessment CRUD, vacancy CRUD, skill taxonomy, session create — all verified via API (curl) and browser.
- Full assessment create with custom skill (name, scope, L1–L5 anchors) verified end-to-end through the UI: submit → API 201 → redirect to invite page.
- No test suite anywhere (RSpec empty, no web test runner, no CI) — risk baseline.
- Interview itself requires real mic + Gemini key; cannot be exercised without a browser with `getUserMedia`/`AudioWorklet` and a valid Gemini key — the hardware check stage gates entry by design.
- `SignupPage` exists but is **not routed** — dead page.
- Seed creates org + 22-skill taxonomy only; **no users** — JWT is minted manually with `user_id` that need not exist in DB (auth trusts claims, no DB lookup).

---

## 2. The Industry — Hiring & Talent Assessment in Indonesia

### What's hard (why this product has a reason to exist)

- **Volume + speed pressure**: Companies (esp. tech) screen hundreds of applicants per role. Manual skill screening is slow, inconsistent, and expensive. Recruiters spend most time filtering, not assessing.
- **Assessor inconsistency**: Different interviewers probe differently; same candidate rates differently across panels. There is no reliable, repeatable behavioral evidence trail.
- **Evidence, not claims**: Candidates recite theory; resume keywords ≠ demonstrated capability. Interviewers struggle to get behavioral evidence quickly.
- **Hard-to-hire skills**: Senior engineering roles need deep, probed evidence (L3–L5). Structured interviews are rare outside mature orgs.

### What's already commoditized

- **Technical quizzes / coding tests**: HackerRank, Codility, LeetCode-style — automated, cheap, but test *recall*, not *behavior*; candidates game them; they don't measure communication, judgment, or seniority.
- **Resume screening / ATS**: filtering keywords, basic matching.
- **Scheduling / video interview recording**: automated one-way video answers (HiBob, HireVue style) — candidate answers pre-set questions, no adaptive probing.
- **Skills taxonomies / leveling frameworks**: existing (internal ladders), but assessment against them is still manual.

### Where real leverage sits (the gap this product occupies)

**Adaptive, probed, voice-based behavioral assessment against an explicit L1–L5 rubric** — this is the "human interviewer" behavior: probing vague/strong claims, following threads, discovering off-agenda skills, and producing *citable evidence* (quotes) for every rating. That's the moat:

- Consistent, repeatable, auditable assessment (same rubric every time).
- Evidence-backed ratings a hiring manager can defend ("he said X, so L3").
- Async scale: one assessor config → unlimited candidates.
- Off-agenda discovery: surfaces skills candidate didn't know were being tested.

---

## 3. What the Product Is For (intended outcome)

- **For the company**: hire better — decide fit using *demonstrated behavioral evidence* mapped to role expectations, faster and cheaper than manual structured interviews.
- **For the assessor**: replace guesswork with a repeatable portfolio of evidence per candidate; ability to *override* AI judgments they disagree with (human-in-the-loop stays source of truth).
- **For the process**: a single candidate → structured skill portfolio → fit/gap vs vacancy → PDF, end to end.

### What must be true for it to stay useful

1. **AI must behave like a skilled interviewer** — probe, not recite (PRD 01). If the AI reads questions, the whole value dies.
2. **Ratings must be defensible** — evidence quotes must actually support the level (confidence rules).
3. **Human override must exist and be authoritative** — AI is a draft, assessor is the decision.
4. **Fair to the candidate** — language, latency, audio quality, device differences must not silently distort scores.
5. **Trustworthy privacy** — candidate voice/identity data must be protected (UU PDP), else legal + reputational death.

---

## 4. The Users — Assessors, Recruiters, Hiring Managers

### Assessor (technical person doing the evaluation) — *primary user*
- Day: multiple roles open, dozens of candidates, interviews booked back-to-back. Little time to read transcripts; wants **the answer + evidence**, fast.
- Job to be done: "Give me a trustworthy skill profile per candidate so I can shortlist or reject without listening to every minute."
- Pain: today this is manual interviews (time) or quiz scores (meaningless).
- Care about: rating accuracy, ability to override, export for HR records, defensibility ("why L3?" → evidence quotes).

### Recruiter (coordinator)
- Day: juggles pipelines, schedules, follows up with candidates, feeds hiring managers.
- Wants: **async, self-serve assessment** they don't need to schedule — send invite link, candidate does it on their own time; recruiter reads the summary later.
- Care about: invite workflow, status visibility (monitor), link expiry/permissions, candidate communication.

### Hiring Manager (decision-maker)
- Wants to answer ONE question: "Does this person fit the role, and where's the gap?"
- Consumes the **fit/gap report** and portfolio PDF; may not look at the platform itself.
- Care about: clear comparison vs role expectations, culture narrative, exportability.

### System-level workflow pain points observed in code
- Auth trusts JWT claims without DB check; role is embedded in token — assessor vs candidate role is claim-based.
- `VITE_DEV_TOKEN`/tenant stubs in web are dev-only crutches (tenant atom is a hardcoded stub "replace with platform context later").
- Candidate identity is thin: session has `candidate_name` but no real candidate account/UU PDP record of consent.

---

## 5. The People Who Never Chose This Product — Candidates

Candidates are **assessed by this product without choosing it**. They can't opt out; a wrong rating changes a real person's job outcome, income, and year.

### Candidate reality
- First-time UX pressure: mic permission, audio quality, latency, background noise, device differences — all affect their performance.
- They don't know the rubric; AI probing can feel unfair or trick-like if done badly.
- One bad rating → rejected; they usually get no feedback or recourse.
- Privacy anxiety: an AI is listening to their voice. Where does it go? Who sees it?

### Fairness obligations (product design level)
- **Transparency**: candidate must know what's assessed, how data is used, who can see it, and how to contest/delete.
- **Consent**: explicit, informed, revocable — before recording starts.
- **Evidence access**: candidate should be able to see the evidence behind a rating (and request correction).
- **Procedural fairness**: override + appeal path exists on the assessor side; candidate should at least know a human reviews it.
- **Accessibility**: don't let mic quality/hardware gate a fair shot.

### UU PDP implications (UU 27/2022) — mapped to specific articles

Source: [UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi](https://peraturan.bpk.go.id/Read/224884/UU%20Nomor%2027%20Tahun%202022.pdf). High-level engineering view, not legal advice.

| UU PDP article | What it says | What it means for this product |
|---|---|---|
| **Pasal 4** | Data pribadi **spesifik** (sensitif) includes *data biometrik*; **umum** includes name, gender, etc. | Voice recording → **data biometrik (spesifik)** if used for identification → stricter handling duty |
| **Pasal 5** | Subject has right to know identity/basis/purpose of data use | Candidate must be told why their voice/transcript is collected, by whom |
| **Pasal 6** | Right to complete/correct inaccurate data | Need a correction path for candidate data |
| **Pasal 7** | Right to access + get a copy | Candidate should be able to retrieve their transcript/portfolio |
| **Pasal 8** | Right to end processing, delete, destroy data | Need data deletion flow |
| **Pasal 9** | Right to withdraw consent | Consent must be revocable; withdraw → stop processing |
| **Pasal 10** | Right to object to decisions based **solely on automated processing** incl. profiling | ⚠️ **Critical**: AI rating is automated decision-making → candidate has right to object; human override path is legally necessary |
| **Pasal 14** | Rights exercised via recorded request (electronic/non-electronic) | Need a mechanism to receive/process requests |
| **Pasal 16** | Processing must be: limited+specific+lawful+transparent, purpose-bound, accurate, secured, notified of failures, destroyed after retention, accountable | Retention policy + purpose limitation + auditability required |
| **Pasal 20** | Need lawful basis; **explicit consent** for specific purposes | Consent = explicit, purpose-scoped (not bundled with T&C) |
| **Pasal 21** | Must inform: legality, purpose, data types, **retention period**, details, processing duration, subject rights | Candidate consent screen must state retention + rights before recording |
| **Pasal 22** | Consent via written/recorded (electronic ok); separate + understandable if mixed purposes | Consent UI must be clear, separate, plain language |
| **Pasal 24** | Must be able to **prove consent** was given | Store consent proof (timestamp, version, request data) |
| **Pasal 30** | Correct data within 3×24h of request | Correction SLA |
| **Pasal 31** | Must record **all processing activities** | Audit log of who accessed/processed session data |
| **Pasal 32** | Give subject access + processing trail within 3×24h | Access/export SLA |
| **Pasal 34** | **DPIA (penilaian dampak)** required for high-risk: automated decisions w/ legal/significant effect, **specific data**, large scale, **systematic evaluation/scoring/monitoring**, new tech | ⚠️ **Directly applicable**: this product = automated scoring of sensitive data → a DPIA is legally indicated |
| **Pasal 35–39** | Security: technical measures, confidentiality, supervise processors, protect from unauthorized access | Encrypt transcripts at rest, access control, no data in logs |
| **Pasal 42–44** | Delete/destroy when: retention reached, purpose done, **subject request**, or unlawfully obtained | Retention policy + deletion implementation |
| **Pasal 46** | Notify subject + authority of data breach within **3×24 hours** | Incident response procedure |
| **Pasal 56** | Transfer abroad only if recipient country has equivalent protection, binding safeguards, or **explicit subject consent** | ⚠️ **Gemini = Google = transfer abroad** → candidate consent must cover third-country processing |
| **Pasal 57** | Admin sanctions incl. fine up to **2% annual revenue** | Financial exposure for non-compliance |
| **Pasal 67–70** | Criminal: imprisonment up to **6 years**, fines up to **Rp 6 billion**, corporate liability | Personal + corporate exposure |

Implication for the build: **consent capture, retention/deletion controls, audit log, DPIA, and breach-notification readiness are not nice-to-haves — they're statutory obligations** and a disqualified risk if missing.

### Code-level observations re: candidate data
- JWT in `localStorage` (plain) — candidate token in URL query (`/interview/:token`) — token URL sharing leaks access.
- No consent record/flag on session; no retention policy visible in schema.
- Transcripts stored plaintext in `transcript_turns`; Gemini requests carry raw transcript to third party (Google) — candidates are not told.
- `candidate_name` on session is free text, no structured candidate record → hard to honor erasure ("delete this candidate's data").

---

## 6. Constraint Signal (early, will be revisited in Step 3)

1. **No test harness at all** (API RSpec empty, no web runner, no CI). Any change ships unproven — highest systemic risk.
2. **Candidate identity is minimal + consent absent** — UU PDP exposure; needs product + data decisions, not just code.
3. **Auth is claim-trusting with shared secret across `rakamin-api`** — architectural coupling; token role escalation would be invisible.
4. **Gemini dependency** — live audio interview is a hard external dependency (key, latency, cost, model availability). Failure modes need design (retry, reconnect, degraded state).
5. **Sidekiq idempotency** for coverage/portfolio workers is fragile (relies on turn ordering, no unique job keys) — double-processing risk.

---

## 7. Assumptions Made (per brief: document and proceed)

- Target user base: Indonesian tech-hiring context (B7 taxonomy, ID/EN languages).
- Product is B2B for employers (Rakamin ecosystem); candidate side is assessee-only.
- UU PDP analysis is high-level (product/engineering view), not legal advice.
- Dev seed intentionally has no users; JWT is a test token, prod auth flows through `rakamin-api`.