# Step 2: Product Context & Domain Immersion

Written after running both services locally and walking the flow end to end as an assessor and as a candidate, before proposing any change. Every claim about the system is traced to the code or the database rather than to the README.

---

## 1. What the product actually is

Not "an AI that interviews people." Concretely, it is a machine for turning a spoken conversation into **a defensible skill level per skill, with the quotes that justify it.**

The pipeline, as built:

```
Assessment            an assessor defines the role and its skills, each with
(name, time limit,    written L1–L5 behavioural anchors — assessment_skills
 language, skills)    carries l1_anchor … l5_anchor, all NOT NULL

      ↓ creates
Session               one candidate, one invite token, one attempt
                      (sessions.invite_token, 64 chars, unique)

      ↓ candidate opens the link
Live interview        voice, both ways, via Gemini Live over WebSocket.
                      The AI decides its own follow-ups — there is no script.

      ↓ during the interview
Coverage map          a state machine per skill: not_yet → initiated →
                      partial → covered, plus a probe_count
                      (Coverage::StateEngine). This is what tells the AI
                      which skills still need pushing, and it is the only
                      record of what was genuinely explored.

      ↓ on session end (N10, background job)
Portfolio             per skill: an AI level 1–5, a confidence, up to three
                      verbatim candidate quotes as evidence, and a short
                      competency summary

      ↓ assessor reviews
Assessor override     a human can replace the AI level. The override stores
                      both the ai_level and the override_level, so the
                      disagreement itself is on record.

      ↓ compared to a role
Fit/Gap report        vacancy expects L4, candidate shows L2 → gap of 2.
                      Rule-based; only the narrative is generated.

      ↓
PDF export            what actually leaves the system and reaches a decision
```

Two design decisions in there matter more than the AI:

**The behavioural anchors.** The assessment does not ask "rate React 1–5." It makes the assessor write down what L1 through L5 *look like* for this role, before anyone is interviewed. That is what turns a number into something a hiring manager can argue with.

**The override, with both numbers kept.** The AI's judgement is a draft, not a verdict, and the product is built to expect a human to disagree with it. This turns out to be the single most important property of the system — see §5.

**What it is not:** not a CV screener, not a personality or culture test, not a proctoring tool. It measures depth on skills that were named in advance.

---

## 2. The industry it sits in

Hiring and talent assessment in Indonesia. I have no proprietary market data, so this section is reasoning from the shape of the problem, and I am labelling it as such rather than dressing assumptions up as findings.

**The bottleneck is depth, not volume.** Sorting applications is already commoditised — every ATS does keyword filtering, and it is nobody's differentiator. What nobody has cheaply is the thing that happens in the 45-minute technical interview: finding out whether a candidate can actually reason through an ambiguous problem, or has only memorised the vocabulary. That hour is expensive because it costs a senior engineer's time, and senior engineers are the scarcest thing a growing company has.

**Which means the real competition is not other assessment tools. It is the CV.** When there is no time for depth, screening falls back to proxies: which campus, which previous employer, how the CV is written. Those proxies are cheap, fast, and systematically wrong about people who did not take a conventional route. A product that makes a structured 30-minute skills conversation cost almost nothing is competing against that fallback, not against another SaaS.

**Where the leverage is, specifically:** consistency and evidence. Ten human interviewers ask ten different sets of questions and each writes down "good communication skills." This system asks against the same anchors every time and stores the quotes. That is auditable in a way a human panel is not — and auditability is exactly what a candidate needs when a decision goes against them.

**Assumption I am carrying into Steps 3–5:** the buyer is a mid-size Indonesian company hiring in volume for similar roles, where the same assessment gets reused across dozens of candidates. That is what makes the anchor-writing effort pay off, and it also means a systematic scoring bug is not one bad decision — it repeats across every candidate who touched that assessment.

---

## 3. What it is for, and what has to stay true

**The outcome it exists to produce:** a hiring decision that is *better evidenced* than the one that would have been made without it — not merely faster.

Speed alone is a trap. A system that produces bad levels quickly is worse than no system, because it launders a guess into something that looks like a measurement. A number with a level, a confidence and three quotes attached carries more authority than a recruiter's gut feeling, and it deserves that authority only if the number is real.

**Three things have to stay true or the product stops being worth using:**

1. **Every score traces to something the candidate actually said.** The moment a level can exist without evidence behind it, the whole artefact becomes noise wearing a suit. *(Step 3 found this was already broken — the generator invented an L1 for skills that were never discussed.)*
2. **Nobody is misled about what happened.** Not the candidate about whether their interview went through, not the assessor about whether a skill was assessed or merely absent. *(Step 3 found both broken.)*
3. **A human stays in the loop, and can disagree cheaply.** The override exists; it must stay easy to reach and must keep both numbers.

**What would make it matter to more people than it reaches today:** it is the same property that makes it legally defensible. A candidate who can see the evidence behind their own assessment is a candidate who can contest it. That is the difference between a tool used *on* people and a tool that can be used *with* them — and it happens to be what UU PDP is pointing at (§5).

---

## 4. The users: assessor, recruiter, hiring manager

Three roles named in the brief. **In the code today there is one.** Every controller is gated by the same check:

```ruby
authorize_auth_token! :assessor   # accepts role "admin" or "assessor"
```

`assessments`, `vacancies`, `sessions`, `portfolios` — all identical. There is no `recruiter` or `hiring_manager` role anywhere in the schema. So the three personas below describe what people are *trying to do*, not what the system distinguishes. That gap becomes Internal P0 in Step 3.

| | What their day looks like | What they need from this product | Where the product fights them today |
|---|---|---|---|
| **Assessor** | Owns the assessment design. Writes the L1–L5 anchors, reviews portfolios, overrides the AI when it is wrong. The most invested and the most technical user. | Trustworthy evidence, and a fast path to disagree with the AI. | Reviews scores without knowing which were earned and which were invented. Reads transcripts with raw system JSON in them. |
| **Recruiter** | Volume. Sends invites, chases candidates, keeps the pipeline moving. Lives in a list view, not a detail view. | To know at a glance which sessions succeeded and which need re-inviting. | Sees "Failed" in the list with no cause, and no way to tell a candidate's connection dropping from a candidate walking away. |
| **Hiring manager** | Sees one or two candidates for one role. Not a daily user, and does not care about the tool. | The Fit/Gap report and nothing else — does this person clear the bar for *my* role. | Reads a gap that may have been computed from a level nobody ever measured. |

**The shared thread:** all three are downstream of the same artefact. None of them watched the interview. Every one of them is trusting a number produced by a system none of them can see inside. That is why data integrity in the generator is not a backend concern — it is the whole product surface for all three.

---

## 5. The people who never chose it: candidates

The candidate has no account, no password, and no settings. They receive a URL with a 64-character token, click it, and talk to a machine for up to an hour. They cannot opt out, cannot see what was recorded, and cannot ask for it back. A wrong result changes a real person's year, and they will never know it was wrong.

**What the system holds about them:**

| Data | Where | Notes |
|---|---|---|
| Name | `sessions.candidate_name` | Optional, but usually set |
| Verbatim transcript, every turn | `transcript_turns.text` | Both speakers, full text, `NOT NULL` |
| Selected quotes | `portfolio_skills.evidence` (jsonb) | Their own words, extracted and stored again |
| Skill judgements about them | `portfolio_skills.ai_level`, `ai_confidence` | Assessments *of a person*, not just data *from* them |
| Audio | in-memory ring buffer only | Not persisted — worth stating, it is the one thing done well |

**Against UU PDP (Law No. 27 of 2022), four gaps stand out:**

1. **No consent moment.** The candidate is never told what is recorded, how long it is kept, or who sees it. Today the pre-start screen talks about microphones and quiet rooms — not about data.
2. **No deletion or retention path.** There is no `deleted_at`, no retention job, no request route. Nothing in the codebase mentions retention at all. Transcripts are kept forever by default, which is the default nobody chose.
3. **Automated decision-making.** Article 10(1) gives a data subject the right to object to a decision based solely on automated processing. This is the one where the product is *closer* to compliant than it looks: `AssessorOverride` is a real human-in-the-loop, and the Fit/Gap comparison is rule-based rather than generated. What is missing is not the mechanism — it is that nothing forces or records the human step, so "a human reviewed this" is a hope rather than a fact.
4. **Breach notification in 3 × 24 hours** (Article 46(1)) assumes you can answer "whose data was in it, and what was exposed." With no data map and no retention boundary, that clock is very hard to meet.

**The judgement I am carrying forward:** the transcript is the most sensitive object in this system, and it is treated as the least sensitive. It sits in a plain text column, it is echoed into model prompts, and — as Step 3 found — it can surface in an error message that gets written to a log. That last one is cheap to fix and is fixed in Step 5. The consent and retention gaps are real, and are deliberately *not* fixed there; the reasoning is in Step 4 §2.6, and the honest reason is that a retention feature nobody designed with legal input is worse than an admitted gap.

---

## 6. What this changes about how I read the codebase

Four things I decided here, before looking for bugs, that shaped Steps 3–5:

1. **An invented score is a P0, not a data-quality nit.** It reaches a hiring decision through the Fit/Gap report, and the people who act on it cannot see that it was invented.
2. **Anything that misinforms the candidate ranks with anything that misinforms the assessor.** The candidate is the party who cannot check, cannot appeal, and did not choose to be here.
3. **The single-attempt design raises the cost of every frontend bug.** There is no retry. A lost session is a lost candidate.
4. **Silence is a failure mode.** A skill that quietly disappears is as misleading as a skill that is quietly invented — which is why the Step 5 fix does not stop at deleting the fabricated row.

---

**Sources for the UU PDP references:**
- [Undang-Undang Nomor 27 Tahun 2022 — JDIH Kemkomdigi](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang+nomor+27+tahun+2022)
- [Pasal 46 UU Pelindungan Data Pribadi](https://uupdp-info.id/pasal-46/)
- [UU PDP: Landasan Hukum Pelindungan Data Pribadi — Hukumonline](https://www.hukumonline.com/klinik/a/uu-pdp--landasan-hukum-pelindungan-data-pribadi-lt5d588c1cc649e/)
