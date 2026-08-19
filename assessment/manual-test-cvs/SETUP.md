# Manual test setup — Vacancy, Assessment, CV Screening

These are the exact field values the 13 generated CVs in this folder were written against. If
you're setting this up fresh (new environment, or you want a second isolated screening), fill
these in exactly as-is — the CVs' expected outcomes (see the table at the bottom) depend on
matching this specific bar, not just "a similar-sounding vacancy."

If you're reusing the existing `Fullstack Engineer (Frontend Depth)` vacancy / `Frontend
Engineer` assessment / `Frontend Hiring Q1` screening already in the dev DB (vacancy id 1,
assessment id 1, cv_screening id 1), you can skip straight to uploading — these already match.

---

## 1. Vacancy — `/vacancies/new`

**Role title**
```
Fullstack Engineer (Frontend Depth)
```

**Expected skills** (Add skill expectation → pick from the picker, set the level slider):

| Skill | Expected level |
|---|---|
| React / Frontend Development Core | 3 |
| Node.js / Backend Development | 3 |
| Problem Solving & Analytical Thinking | 3 |
| Communication | 3 |

**Company culture (used in AI narrative)**
```
Open Discusion, Open for Feedback
```

**Competency expectations (used in AI narrative)** — this is long; paste as one block:
```
Description

Job Description
On our delivery squads, every engineer owns a module across the whole stack, its UI, its API, its data, and its tests, and carries it from prototype to working, tested software.

Depth is where you go deeper than the rest of the squad, while still owning your module end to end. Your depth is the frontend: the modules with hard web UI such as dashboards, data visualization, design-system implementation, and performance tuning. When a module has a difficult interface, it comes to you, and you build its API, its data, and its tests too, like every fullstack owner. You are the person the squad trusts with the hard UI problem, and you keep building the rest of the module yourself.

From day one, you own real modules on live client squads and on internal product, at a scope matched to your experience: routine-to-common frontend complexity you run independently, with a Technical Lead, a more senior fullstack engineer, or the Product Designer backing you on the hardest interface calls. As your frontend mastery deepens, the scope you own grows with it, on a clear path toward owning the seat's hardest frontend cores outright.

What you will do

Own a module across the whole stack: build its UI, the API behind it, its data, and its tests. You finish a whole feature.
Take the modules where the interface is the hard part (dashboards, data visualization, design-system work, performance) and go deep there, while still delivering the rest of the module yourself.
Build against the hi-fi prototype so a screen matches it exactly. A screen that looks different from the prototype is treated as a bug.
Write the tests for what you build, from week one, as continuous regression.
Turn a Definition of Done and a clickable prototype into working, traceable software, on real client engagements.
Join story kickoffs and walk the acceptance criteria and edge cases before you write code.
Use the design-to-code pipeline and AI as leverage, then verify. Producing plausible UI is cheap. Matching the prototype and the persona is the skill.

What you own now

Modules built fullstack, end to end, at routine-to-common frontend complexity: UI, API, data, and tests, traced to a requirement and matching the prototype.
Your module's defects and its demo, including at least one dashboard or visualization view a stakeholder actually uses.

Who you will work with

Reports to: Technical Lead. Hiring decision: CTO.
You get a prototype and a Definition of Done from the product and tech layers, you get design fidelity checks from the Product Designer, and you hand the SDET a module that is testable in CI.

Required qualification

Must have

Min. 3 years of professional experience shipping fullstack features in production, or equivalent demonstrable skill.
Can build and ship a feature across the whole stack: the screen, the API behind it, the data, and the tests. Our internal platform is a React (TypeScript) web app on Vite and a Express.js + Ruby on Rails API; fullstack experience in any comparable stack transfers in fast, Rails included.
Extra strength on the frontend: a good eye, clean component work, and a build that matches the design (spacing and states included) are where you are most comfortable and want to go deepest.
Writes tests for their own code as standard practice, unprompted.
Uses AI and design-to-code tooling as leverage and verifies every result before shipping it.
Comfortable working directly with client-facing deliverables under a Technical Lead's guidance.
Any exposure to a design system, Figma handoff, or a design-to-code workflow.

Nice to have

Data-visualization or dashboard experience (charts, tables at scale, performance tuning).
Consulting or enterprise-client delivery experience.
A shipped fullstack project (production, personal, or open source) you can walk us through and defend.
Deep backend architecture.
```

**Public requirement text** — this is the field CV screening's Layer 1 gate checks against; keep it short and candidate-readable:
```
We need 3+ years of React and Node.js experience, strong communication, and ownership mentality.
```

---

## 2. Assessment — `/assessments/new`

**Name**
```
Frontend Engineer
```

**Time limit**
```
45 minutes
```

**Language**
```
en
```

**Expected skills:**

| Skill | Expected level |
|---|---|
| React / Frontend Development Core | 3 |
| TypeScript & Type Systems | 3 |

(Uses the same skill picker as the vacancy — pick these two specifically; they're a different pair than the vacancy's four, since the assessment is what a candidate actually gets interviewed on post-invite, not what the CV is screened against.)

---

## 3. CV Screening — `/cv-screenings/new`

**Screening name**
```
Frontend Hiring Q1
```

**Vacancy** → select the vacancy you just created above.

**Assessment** → select the assessment you just created above.

**Auto-invite threshold**
```
70
```

---

## What each generated CV should do

Upload all 13 from this folder in one batch, or a few at a time — either works. Expected outcome
per file, once Gemini actually processes each one:

| File | Expected decision | Expected `decision_reason` |
|---|---|---|
| `01-invited-maya-herlambang.pdf` | `invited` | `auto_invited` (score ≥ 70) |
| `02-invited-deni-saputra.pdf` | `invited` | `auto_invited` (score ≥ 70) |
| `03-invited-andini-wulandari.pdf` | `invited` | `auto_invited` (score ≥ 70) |
| `04-needs-review-below-threshold-fajar-ramadhan.pdf` | `needs_review` | `below_private_threshold` |
| `05-needs-review-below-threshold-siti-nurjanah.pdf` | `needs_review` | `below_private_threshold` |
| `06-needs-review-below-threshold-bagus-prasetyo.pdf` | `needs_review` | `below_private_threshold` |
| `07-not-advanced-rian-kusuma.pdf` | `not_advanced` | `failed_public_gate` (feedback email sent) |
| `08-not-advanced-lestari-wijaya.pdf` | `not_advanced` | `failed_public_gate` (feedback email sent) |
| `09-not-advanced-herman-tanoto.pdf` | `not_advanced` | `failed_public_gate` (feedback email sent) |
| `10-needs-review-no-email-putri-anggraini.pdf` | `needs_review` | `no_email_detected` |
| `11-needs-review-no-email-yoga-pratama.pdf` | `needs_review` | `no_email_detected` |
| `12-needs-review-multiple-emails-nadia-kartika.pdf` | `needs_review` | ambiguous email (multiple found) |
| `13-needs-review-multiple-emails-aditya-firmansyah.pdf` | `needs_review` | ambiguous email (multiple found) |

Categories 1–3 (`invited` / `below_private_threshold` / `failed_public_gate`) depend on a real
Gemini call at upload time, so treat them as "should land here" rather than guaranteed — the
content was written to be unambiguous against the vacancy bar above, but LLM judgment isn't
bit-for-bit deterministic. Categories 4–5 (email detection) were verified deterministically
against the actual `CvScreenings::EmailDetector` service before these files were handed over, so
those two should be exact every time.

If a batch resolves with every entry landing the same way (e.g. you upload only the `invited`
three in one batch), FR5's mass-batch confirm gate will hold the notifications for you to
manually confirm rather than auto-sending — that's expected behavior, not a bug, if it happens.
