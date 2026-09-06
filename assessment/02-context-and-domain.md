# Step 2 — Product Context & Domain Immersion

Written after running both services locally, walking the assessor's workflow in a
browser, inspecting the database directly, and reading the two PRDs published in
the repository wiki. Where a claim comes from reasoning rather than observation,
it says so.

---

## 1. The Product

**What it is, in one sentence:** a machine that converts roughly forty minutes of
spoken conversation into a number between 1 and 5 per skill, so that a recruiter
can decide whether to hire someone without listening to the recording.

Everything in the codebase serves that sentence. The chain runs in four acts:

| Act | What happens | Where it lives |
|---|---|---|
| **1. Setup** | An assessor defines skills, writes L1–L5 *behavioural anchors* for each, sets an expected level and a time limit. The system compiles that into a system prompt and issues an invite link. | `SystemPromptCompiler`, `assessment_skills` |
| **2. Interview** | The candidate talks to an AI over live audio. Every turn is stored. A second model watches in the background and maintains a scorecard per skill — `not_yet → initiated → partial → covered` — which is injected back into the interviewer's context each turn to steer what it probes next. | `Coverage::Analyzer`, `Coverage::MapInjector` |
| **3. Verdict** | A stronger model reads the full transcript and the final scorecard and produces a **portfolio**: a level, a confidence (`high`/`medium`/`low`), and two or three verbatim quotes per skill. | `Portfolios::Generator` |
| **4. Decision** | The assessor reviews, may **override** a level, then runs **fit/gap** against a vacancy's required levels. Output is a table of match / gap / exceed / not assessed, and a PDF. | `FitGap::Engine`, `Exports::PdfGenerator` |

### What I learned by using it rather than reading it

Three things only became visible from the running product.

**The behavioural anchor is the whole mechanism.** On paper "L3" is arbitrary.
In the assessment editor it is a written description — *"Designs and builds
complex features end-to-end. Optimizes rendering. Owns test strategy for their
area."* That is a **behaviourally anchored rating scale**, a technique from
industrial psychology that exists so two different raters converge on the same
number. It is what separates this product from a chatbot with a scoreboard: the
anchors are the reason a level is arguable at all. They flow into both the
interviewer's prompt and the portfolio generator's prompt, so they constrain the
question *and* the judgement.

**The system is unusually honest with itself, and then stops being honest with
the user.** It tracks `probe_count`, it distinguishes four coverage states, and
it makes the portfolio generator state a confidence. That is a system built by
people who understood that an inference from a conversation is not a
measurement. All of it reaches the API payload of the final screen. None of it
reached the screen. That gap is the subject of Step 3 and of the change I shipped.

**The decision surface had no reproducible path to being looked at.** `db:seed`
creates an organisation and 22 taxonomy skills and nothing else — no assessment,
no session, no portfolio, no vacancy. The only way to reach the portfolio and
fit/gap screens was to run a real Gemini Live interview end to end. A screen that
cannot be opened cannot be reviewed, demoed, or QA'd, which is a sufficient
explanation for how a blank column survived to `main`.

---

## 2. The Industry — hiring and talent assessment in Indonesia

I have not surveyed this market, and I am not going to quote figures I cannot
verify. What follows is reasoning from the structure of the problem, which is
what the product's design has to survive anyway.

**What is already commoditised.** Job boards, applicant tracking, CV parsing,
and off-the-shelf psychometrics. These are cheap, plentiful, and largely
undifferentiated. Critically, all of them are good at *filtering* — narrowing
many applicants to fewer — and none of them produce evidence about what a person
can actually do.

**What stays expensive.** The hour of a senior engineer who is competent at
interviewing. That cost has a specific shape:

- it does not fall with volume — the tenth interview costs what the first did;
- it competes directly with delivery work, so it is the first thing cut when a
  team is busy;
- it is unevenly distributed — the people best qualified to assess are the people
  least available;
- and its quality is invisible. A bad interviewer and a good one produce
  identically formatted feedback.

**Where the leverage sits.** Precisely there: scaling evidence-based assessment
without scaling senior-engineer hours. That is a real and large lever in a market
with a wide, young applicant pool and a thin layer of senior engineers to
evaluate it — a structural feature of Indonesian tech hiring that is visible in
any engineering org's headcount pyramid.

**The catch, and it decides the product.** That leverage only converts into value
if the output is **trusted**, and trust is not produced by confidence. It is
produced by *calibration* — the output being right about how sure it is. An
assessment that is confidently wrong is worse than no assessment, because it
displaces the senior-engineer hour it was meant to substitute for while carrying
more institutional authority than a human opinion would.

This is why I treated the fit/gap surface as the highest-value thing in the
codebase rather than the AI's probing behaviour. The interviewer can be improved
indefinitely; if the last screen launders uncertainty into false precision, none
of that improvement reaches the decision.

---

## 3. What It Is For

**The outcome it exists to produce:** a hiring judgement that can be *defended* —
to a hiring manager, to a rejected candidate, and to a regulator — not merely one
that arrives quickly.

Speed is the visible benefit and the trivial one. Any tool can be fast. The
durable claim is *"here is the level, here is the evidence, here is how sure we
are, and here is where a human corrected the machine."*

**What has to stay true for it to keep being useful:**

1. **Levels must mean the same thing across sessions and assessors.** The anchors
   carry this. If assessors write vague anchors, the number reverts to opinion
   with extra steps.
2. **Uncertainty must survive to the decision-maker.** The moment a low-evidence
   rating is displayed identically to a well-evidenced one, the product is
   manufacturing confidence rather than measuring capability.
3. **The human override must be real and visible.** It is the only mechanism
   turning automated processing into a reviewed decision — legally as well as
   practically. A correction that disappears from the deciding screen trains the
   reviewer to stop correcting.
4. **A wrong result must be cheap to detect.** Evidence quotes are what make that
   possible: an assessor can read three sentences and see whether the level is
   defensible.

**What would make it matter to more people than it reaches today.** Two moves,
in order of leverage:

- **Give the candidate something back.** Today the candidate supplies forty
  minutes of labour, receives a decision, and never sees the assessment made of
  them. A portfolio with evidence quotes is genuinely useful to the person it
  describes — it is the first interview feedback most candidates will ever get
  that is specific. It also converts an extractive interaction into a reciprocal
  one, which is the difference between a tool candidates tolerate and one they
  recommend.
- **Serve the roles where the senior-interviewer shortage bites hardest** — high
  volume, junior-to-mid, outside the major metros, where a structured
  evidence-based interview is currently unavailable at any price rather than
  merely expensive.

---

## 4. The Users — assessors, recruiters, hiring managers

The reference persona in PRD-02 is Dimas, an HR lead. What matters about him is
not his title but three constraints on his day:

**He is not the domain expert.** He is deciding about frontend engineering
without being a frontend engineer. He cannot look at a rating and know whether it
is right; he can only look at the *evidence* and judge whether it is plausible.
That is why the quotes are load-bearing, and why an unlabelled number is close to
useless to him.

**He is deciding in bulk, under time pressure.** He is not comparing one
candidate to an ideal; he is comparing several to each other while a role sits
open. He will not re-listen to 38 minutes of audio — that is the entire premise
of the product. He reads a table and decides.

**He is accountable for the decision, and the tool is not.** If the hire fails,
it is his judgement that is questioned. This makes his real need
*defensibility*, not speed — and it makes the fit/gap table the artifact he will
be asked to justify.

### What that implies for the interface

Everything on the deciding screen is either supporting a defence or getting in
the way of one. Applied to the fit/gap table:

- A level without the required level is not a comparison. He cannot tell whether
  L2 is a problem.
- Two identical badges with different evidence behind them actively mislead him,
  because he will treat visual sameness as equivalent reliability.
- An unassessed requirement rendered as a blank invites the inference that the
  candidate lacks the skill. That is the most consequential possible
  misreading — and the cheapest to prevent.
- His own override, if invisible, means his correction has no institutional
  memory. The next person to open the report sees a machine verdict.

---

## 5. The People Affected Who Never Chose It — candidates

Ahmad Rizky in PRD-02 did not select this tool, cannot opt out of it, and cannot
see what it concluded about him. A wrong result changes a year of his life. Every
defect above is absorbed by him.

The asymmetry is worth stating plainly. The assessor's worst case is a
mis-hire — costly, recoverable, and visible. The candidate's worst case is a
rejection built on a guess that was displayed as a measurement — and he never
learns it happened, so it cannot be contested or corrected. **The party with no
agency carries the error that is hardest to detect.**

Two specific harms from the current implementation:

- **A `gap` derived from one unverified quote is displayed exactly like a `gap`
  backed by five probes and three quotes.** A candidate is rejected on a guess
  wearing the costume of a measurement.
- **A required skill that was never asked about renders as a dash.** Absence of
  evidence is presented as evidence of absence — the candidate is penalised for a
  question the interviewer ran out of time to ask.

### UU PDP (Law 27/2022), concretely

Voice recordings, transcripts, competency judgements and character assessments
are personal data. Four provisions bear directly on this product, and each maps
to something in the code rather than to a policy document:

| Principle | Where it lands in this system |
|---|---|
| **Accuracy** of personal data | A rating whose evidentiary basis is hidden from the reviewer is hard to defend as an accurate processing outcome. Surfacing confidence and evidence count is an accuracy control, not a UI nicety. |
| **Transparency** of processing | The candidate is told a decision, never the basis. Nothing in the product is built to show them the portfolio made about them. |
| **Right to correct** | The assessor override is the only correction mechanism, and it is exercised by the assessor, not the subject. When it is invisible on the deciding screen, the correction is effectively lost. |
| **Decisions based on automated processing** | If the human reviewer cannot see how much evidence supports a rating, their review is decorative and the decision drifts back to being purely automated — which is the situation the provision exists to constrain. |
| **Data minimisation** | Verbatim quotes are the minimum needed to defend a rating, which is a good argument for keeping them. Cross-tenant reachability of those quotes is not defensible under any reading — see the P0 in Step 3. |

**The design conclusion I took from this pillar:** the candidate is not a
secondary stakeholder to be considered after the user's needs are met. The
uncertainty signals that protect the candidate from a bad rejection are the same
signals that make the assessor's decision defensible. Serving one serves the
other. Where the product currently fails, it fails both at once — which is why
restoring them was worth more than any new feature I could have added.
