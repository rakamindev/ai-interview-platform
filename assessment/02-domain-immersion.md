# Step 2: Domain immersion

## In one paragraph

This product replaces the first technical interview with a voice conversation run by an AI. An assessor configures
the skills a role needs and what each level (L1 to L5) looks like. The candidate opens a link and talks to an AI
interviewer that probes their answers instead of reading a question list. When the session ends, a model turns the
transcript into a **skill portfolio**: a level, a confidence, evidence quotes and a summary for every skill. A
**fit/gap report** then compares that portfolio with a vacancy's expected levels. The output is meant to be
defensible: a hiring team should be able to point at the quotes and say why a candidate is L2 and not L3.

Everything below asks one question from five angles: **what does it take for that rating to be worth trusting, by
the people who act on it and by the person it describes?**

Sources: the product spec (wiki [PRD 01](https://github.com/rakamindev/ai-interview-platform/wiki) on interview
behavior and PRD 02, an end-to-end simulation), the code, the running app, and the external sources listed at
the end. Statements marked **assumption** are mine and still need checking.

---

## Pillar 1: The product, used end to end

| # | Who | Screen | What happens | What is stored |
|---|---|---|---|---|
| 1 | Assessor | `/login` | Signs in. Only users with `role == 'admin'` can log in. | JWT with `user_id`, `role`, tenant `scheme` |
| 2 | Assessor | `/assessments/new` | Names the role, picks a time limit (10/30/45/60/90 min) and the interview language (English or Bahasa Indonesia), adds skills from the taxonomy or as custom skills with L1–L5 anchors and an expected level. | `assessments`, `assessment_skills`; the system prompt is compiled once and stored |
| 3 | Assessor | `/assessments/:id/invite` | Creates an invite link per candidate (name optional) and sends it outside the product (email, WhatsApp). | `sessions` row: `pending`, `invite_token` |
| 4 | Candidate | `/interview/:token` | Reads four bullet points, passes a mic/hardware check, clicks Start. Talks to the AI. Can end at any time. | Audio is streamed to Gemini Live and held only in a 60-second in-memory buffer for reconnects; transcript turns are stored |
| 5 | System | (background) | After each candidate turn, a fast model updates the **coverage map** (`not_yet → initiated → partial → covered`), which steers the interviewer's next question. | `coverage_maps` |
| 6 | Assessor | `/…/monitor` | Can watch coverage change live. | n/a |
| 7 | System | (Sidekiq) | When the session ends (all covered, time ceiling, candidate or assessor ends it, or an error), a model generates the portfolio. | `portfolios`, `portfolio_skills` (level, confidence, evidence, summary) |
| 8 | Assessor | `/…/portfolio`, `/…/transcript` | Reviews each skill, reads evidence, can override the AI's level with a note, exports a PDF. | `assessor_overrides` |
| 9 | Assessor | `/vacancies`, `/…/fitgap/:vacancyId` | Defines a vacancy (expected levels, culture dimensions) and runs fit/gap: match / gap / exceed per skill, plus a narrative. | `vacancies`, `fit_gap_reports` |

**What I could and couldn't use.** Steps 1–3 and 8–9 ran in the browser. A live voice interview (steps 4–6) needs
Gemini Live: I set up a key on the free tier, and the default model IDs turned out to be retired (work log 1.4).
For the post-interview pipeline, Step 3 used the real services with a stubbed model response, which is
reproducible and doesn't depend on an unreliable free-tier model.

**What stood out as a user** (adds to [03-problem-and-gap.md](03-problem-and-gap.md)):

- The product's center of gravity is step 8, not the interview. The interview is impressive, but what someone
  *acts on* is the portfolio and fit/gap. That's where trust is won or lost, and where Step 3 found the P0/P1s.
- **The candidate side is English only.** An assessment set to Bahasa Indonesia gets an AI that speaks Indonesian,
  but the page around it (instructions, the hardware check, "End interview?", "Interview Complete") stays in
  English. The web app has no localization. *(New gap; fits P2.)*
- **The interviewer is told never to switch languages**, "even if the candidate uses another language". Mixing
  Indonesian and English in one sentence is normal in Indonesian tech workplaces (**assumption**, but widely
  observed). A candidate who answers partly in English in a Bahasa interview gets pulled back rather than heard.
  *(Spec question, not a defect.)*

---

## Pillar 2: The industry: hiring and talent assessment in Indonesia

**Where AI stands in Indonesian hiring.** In a Jobstreet by SEEK survey of 1,273 HR and recruitment practitioners
(Sep–Oct 2024), **80% of Indonesian companies did not use AI in recruitment**. Those that do use it mostly for
early screening, and humans still make the final decision. The reasons given for *not* using it:

| Reason | Share |
|---|---|
| Lack of human touch / personalization | 44% |
| Increased cost | 40% |
| Not needed | 39% |
| Risk of bias | 38% |
| Lack of knowledge or access | 34% |
| Errors caused by AI | 27% |
| Ethical concerns | 15% |
| Compliance issues | 12% |

**What that means for this product.** It's selling into a market where most buyers are still skeptical, and their
top objections are exactly what this product claims to address or risks confirming:

- "No human touch" → the PRD's whole bet is an interviewer that *listens and probes* like a person (PRD 01 §1).
  That's the differentiator, and it's real in the prompt design.
- "Risk of bias" and "errors caused by AI" (38% and 27%) → this is where the product is weakest today. Step 3's
  P0-1 (unassessed skills stored as L1) and P1-5 (unverified quotes) are precisely "AI errors" a skeptical HR
  lead would find in their first week. **One visible fabricated rating can lose an early-adopter customer.**
- "Compliance issues" (12%) is low today but will rise. UU PDP's transition period ended in October 2024 (Pillar 5).

**How the market hires (assumptions to check against my own experience):**

- **Volume.** Entry-level and junior tech roles get large applicant pools, and initial screening is the bottleneck.
  An AI interview fits the step between the CV screen and the first human technical interview.
- **Assessors aren't always technical.** PRD 02's assessor is "Dimas, HR lead", rating a *Senior Frontend
  Engineer*. An HR lead can't judge React depth themselves, so they depend on the **evidence quotes** and anchors.
  That makes the quotes load-bearing, not decorative.
- **Two languages.** Interviews happen in Bahasa Indonesia, English or both. Multinationals and many startups
  interview in English; much of the market doesn't. The product supports both, but only halfway (Pillar 1).
- **Unreliable connections and devices.** Many candidates join from a phone or a shared space, on mobile data.
  Dropped sessions are a normal case to design for, not an edge case.

> **Input wanted from the candidate (me):** my own experience of being hired and hiring in Indonesia, to confirm or
> correct the four points above before this goes into the report.

---

## Pillar 3: What it's for

**The job to be done:** *give a hiring team a level per skill that they can defend, without spending an
engineer's hour on every first-round candidate.*

Two halves, and the product only works if both hold:

1. **Save expert time.** The AI does the probing a senior engineer would do, at scale.
2. **Produce a defensible result.** The output replaces a judgment someone used to be accountable for. So it has
   to carry its own justification: which quotes, against which anchor, with what confidence.

**What a wrong result costs.** The two errors aren't symmetric:

- **False low** (rated below true ability): a qualified candidate is rejected and never finds out why. The company
  loses a hire; the candidate loses an opportunity. Nobody notices, because nobody re-checks a rejection.
- **False high**: a weak candidate goes to the next round, where a human interviewer catches it. It costs an hour.

The false low is the one that matters most, because it's **silent**. Step 3's P0-1 manufactures exactly this
error: a skill that was never discussed becomes L1, and fit/gap shows it as a gap. That's why the result pipeline
is the Step 4 focus.

**What the product must *not* be.** The output is input to a human decision, not the decision. Nothing in the
product should let it slide into auto-rejecting. Ethically (Pillar 5), legally (UU PDP Art. 10), and commercially
(the 44% "no human touch" objection) it's a decision *support* tool.

---

## Pillar 4: The users who act on the result

| User | The decision they make | What they need from the product | What they get today |
|---|---|---|---|
| **Assessor** (HR lead or technical interviewer; in the code, the only role that can log in) | Is this rating right? Override or accept? Who moves to the next round? | To tell *measured-low* apart from *never-measured*; quotes they can verify against the transcript; a clear signal when something failed. | An L1 that might be fabricated; quotes that might be invented; spinners and blank pages on failure (P0-1, P1-5, P2-1). |
| **Recruiter** | Who to invite, chase or follow up; which assessments need attention. | A list showing what's waiting: who finished, who dropped out, whose results failed. | A list that only loads 20 assessments and shows every ended session as "completed" (P1-8, P1-9, P2-9). |
| **Hiring manager** | Hire / no hire / one more interview, and what to probe in it. | Fit/gap they can trust: real gaps vs unknowns, and what to ask next. | A fit/gap that counts never-discussed skills as gaps (P1-1) and, on the web, a broken required-level column (P1-2). |

Notes:

- **There's no hiring-manager or recruiter role.** Only `admin` can log in, and any admin sees every assessment in
  the tenant. That's fine for an MVP, but it means today the "users" are one persona with three jobs.
- **The override is the human-in-the-loop mechanism.** It only works if the assessor knows *when* to doubt the AI.
  A confidence badge on a fabricated level gives them no reason to.
- **PRD 02's own simulation contains the needed behavior**: Dimas reads the Communication evidence, agrees, and uses
  the gap to decide *what to probe next*. The product's job is to make that reading honest.

---

## Pillar 5: Candidates who never chose this

The candidate didn't pick this tool, can't see its output, and usually can't refuse it without losing the job
opportunity. That power gap is the reason to design for them explicitly.

### Their experience today

1. Gets a link from a recruiter, usually without context.
2. Sees four bullet points: voice interview, follow-up questions, time limit, "Your mic will be active throughout.
   You can end anytime." Nothing says an AI will **rate** them, who sees the result, which company processes the
   audio, or how long anything is kept.
3. Talks to the AI. If the connection drops, or they press **End interview** ("Are you sure you want to end the
   interview early?"), the session ends.
4. Sees "Thank you. The interview has been recorded." That's the first time recording is mentioned, and it's after
   the fact.
5. Never sees the result, and can't correct it or ask for it to be deleted.

**The sharpest problem:** the product tells the candidate *"You can end anytime"*, and ending early silently turns
every skill not yet reached into an **L1** (P0-1). The candidate is penalized for using an option the product
offered, and is never told that will happen. The same applies to a dropped connection, which in Indonesia is
common, not rare (Pillar 2).

### What UU PDP (Law 27/2022) requires, against what the product does

UU PDP was enacted in October 2022 with a two-year transition (Art. 74), so it has applied in full since
October 2024. Administrative fines go up to **2% of annual revenue** (Art. 57(3)). Mapped to this product:

| Article | Requirement (paraphrased) | Today | Gap |
|---|---|---|---|
| **Art. 20–22** | Processing needs a lawful basis; if that's consent, it must be written or recorded. Before processing, the controller must state the purpose, data types, retention period and the subject's rights. | No notice and no consent step before the interview (P2-4). | **Missing**: notice + recorded consent before the mic opens |
| **Art. 5** | Right to know who is processing the data, on what basis, and for what purpose. | The candidate isn't told an AI rates them, or that Google processes their audio. | Missing |
| **Art. 10** | Right to object to decisions based **solely on automated processing, including profiling**, with significant effects. The law's own definition of profiling names *work history, reliability and behavior*. | A skill rating is profiling. Today a human *can* review, but nothing guarantees it, and the candidate isn't told they can object. | Design rule: the output stays decision **support**, and a human review step is visible |
| **Art. 7, 8, 44** | Right of access, right to erasure; the controller must destroy data when its retention period ends or the subject asks. | No retention period, no erasure path for transcripts or portfolios (constraint C4). | Missing (product and legal decision) |
| **Art. 34** | Data protection impact assessment for high-risk processing, which explicitly includes automated decisions with legal or significant effects, systematic evaluation, and new technology. | None known. | Escalate: this product clearly qualifies |
| **Art. 56** | Cross-border transfer only to a country with equal or better protection, or with binding safeguards. | Audio and transcripts go to Google's Gemini API. | Escalate: needs a documented transfer basis |

### A related finding: the model tier matters legally

The [Gemini API terms](https://ai.google.dev/gemini-api/terms) say that on the **free (unpaid) tier**, Google
uses submitted content to improve its products, **human reviewers may read inputs and outputs**, and users must
**not submit personal information**. Only the paid tier excludes prompts from training. A real candidate's
interview audio and transcript are personal information. Running this product for real candidates on the
free tier would breach the provider's terms and expose candidate data to review by third parties. This repo's dev
setup uses the free tier with synthetic data only. **Production must be on a paid tier, and that should be a
deploy-time check, not a convention.** *(Constraint signal; add to C1/C4.)*

### Design principles for the candidate

1. **Tell them before, not after.** An AI interviewer, AI scoring, the purpose, who sees it, who processes it,
   how long it's kept, how to request deletion. In the interview's language.
2. **Never turn missing evidence into a low score.** Ending early or dropping out produces *not assessed*, not
   L1. This is the candidate-side face of P0-1.
3. **Make the consequences of ending early honest.** "Skills we haven't reached yet won't be rated" is fair.
   Silence is not.
4. **A human stays accountable.** The rating is input to a person's decision, and the product should show who
   reviewed it.
5. **Accessibility is an equity issue.** A voice-only interview excludes candidates who are deaf, hard of hearing,
   or have a speech impairment. There's no alternative format. *(Out of scope to build now; worth stating.)*

---

## What this means for Step 4

All five pillars point at the same place: **the step that turns an interview into a rating.**

- The industry's top objections are AI errors and bias (Pillar 2). The fabricated L1 is both.
- The product's purpose is a *defensible* result (Pillar 3). A rating with no evidence behind it isn't.
- Every user downstream acts on that rating (Pillar 4).
- The candidate is hurt most by it, silently, for using an option the product offered (Pillar 5).

So Step 4 should make the result pipeline **honest about what it didn't measure**, end to end: the generator,
the data model, fit/gap and the portfolio/fit-gap screens. Candidate notice and consent (P2-4) is the next most
valuable change, and is the natural follow-up if time allows.

## Assumptions and open questions

- **Assumption:** Indonesian tech candidates commonly mix Indonesian and English, so a strict one-language rule
  hurts some candidates. To be confirmed with my own experience and, ideally, real session transcripts.
- **Assumption:** most candidates are early-career and join from phones or unstable connections. No data in the
  repo to check this.
- **Open (legal):** which lawful basis the client company relies on (consent vs legitimate interest), and who is
  the controller vs processor between the client company and the platform. That decides who owns the notice and
  the erasure flow.
- **Open (product):** whether candidates should ever see their own portfolio. It's good for trust and the right of
  access, but it changes what the product is.

## Sources

- Product spec: [rakamindev/ai-interview-platform wiki](https://github.com/rakamindev/ai-interview-platform/wiki)
  (PRD 01, PRD 02).
- UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi, full text:
  [Wikisource](https://id.wikisource.org/wiki/Undang-Undang_Republik_Indonesia_Nomor_27_Tahun_2022),
  [JDIH BPK](https://peraturan.bpk.go.id/Home/Details/229798/uu-).
- Jobstreet by SEEK, *Hiring, Compensation & Benefits 2025* survey, via Databoks:
  [Why 80% of Indonesian companies don't use AI for recruitment](https://databoks.katadata.co.id/en/technology-telecommunications/statistics/68411edceaad4/why-80-of-indonesian-companies-dont-use-ai-for-recruitment),
  [AI usage in employee recruitment in Indonesia](https://databoks.katadata.co.id/en/technology-telecommunications/statistics/68400c0beeb2a/ai-usage-in-employee-recruitment-in-indonesia).
- [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms) (unpaid vs paid data use).
