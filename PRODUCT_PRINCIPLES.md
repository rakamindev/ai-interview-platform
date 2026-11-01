# Product Principles — AI Interview Platform

This document contains product-specific engineering invariants distilled from the provided **PRD 01 — First Principles: AI Interview Behavior** and **PRD 02 — Real Simulation: End-to-End Interview**. Consult the original [GitHub Wiki](https://github.com/rakamindev/ai-interview-platform/wiki) for detailed prompt templates, JSON schemas, and the reference simulation. Treat this document as a working orientation, not a substitute for checking the PRD and actual code.

## 1. What the product must accomplish

The product's core promise is a **defensible, evidence-based assessment of demonstrated skills**. The AI interviewer must behave like an attentive human interviewer: listen, probe specific claims, challenge vague answers, proportionally stress-test strong answers, follow relevant conversational threads, transition naturally, and know when enough evidence has been gathered.

A fixed questionnaire that asks a new unrelated question after every answer violates this principle, even if its speech sounds fluent.

### Good and bad probing

**Bad:** Candidate describes rendering problems under real-time websocket updates. AI says, “Next question: what is your experience with TypeScript?”

**Good:** AI asks what caused the unnecessary renders, how the candidate measured the problem, and what changed after the fix.

Follow-ups must not put answers in the candidate's mouth. Acknowledgments should be brief and genuine, not repetitive praise. The PRD expects short AI turns, conversational tone, and natural transitions rather than announcing each skill by name.

## 2. Expected end-to-end workflow

1. **Assessor setup:** configure role, duration, skills, scopes, and expected L1–L5 behavioral anchors; create an invite.
2. **System prompt:** compile the configured assessment into a Gemini Live instruction; do not substitute a static question list.
3. **Interview start:** initialize session and skill coverage, check microphone permissions, and connect browser audio through the backend to Gemini Live.
4. **Interview turns:** persist candidate/AI transcripts; asynchronously analyze candidate answers; update coverage; inject an up-to-date coverage map into the next appropriate AI turn.
5. **Session end:** gracefully close after configured skills are sufficiently assessed or the time limit forces closure; preserve incomplete coverage honestly.
6. **Portfolio generation:** use the full transcript, final coverage, and skill definitions to produce evidenced ratings, distinct confidence, and summaries.
7. **Assessor review and fit/gap:** show evidence alongside ratings, compare against vacancy requirements, offer an understandable narrative, and support export.

PRD 02 is a *reference simulation*, not proof that every step works in the current repository. Trace the actual workflow before changing it.

## 3. Coverage state machine

Configured skills use:

`not_yet → initiated → partial → covered`

- `not_yet`: the skill has not been meaningfully explored.
- `initiated`: an opening question/exchange occurred.
- `partial`: at least one meaningful follow-up occurred, but the evidence remains insufficient for a defensible L1–L5 rating.
- `covered`: there is enough behavioral evidence to defend a rating with specific transcript statements.
- `discovered`: the candidate mentioned a relevant off-agenda skill, which should be briefly probed before returning to the configured assessment.

**Hard rule from PRD 01:** a configured skill cannot advance past `initiated` unless `probe_count >= 2`. Even an exceptional first answer does not override this. `probe_count` counts meaningful skill exchanges, not raw words or transcript turns indiscriminately. A skill cannot become `covered` solely because it reached the probe threshold; evidence sufficiency is an additional requirement.

The model may propose transitions, but deterministic application logic should reject impossible states, unknown skill IDs, negative counts, stale regressions, and invalid outputs. Preserve valid current state if analysis fails.

### Coverage injection and async behavior

The Gemini Live session receives a hidden coverage map before AI responses. Coverage analysis runs asynchronously using recent transcript turns; a **one-turn lag is acceptable** in the PRD's reference scenario. Do not block audio indefinitely waiting for a background model response. Equally, do not let a delayed analyzer job overwrite newer coverage or change state out of order.

The PRD's illustrative priority ordering is `not_yet > initiated > partial > discovered > covered`, while its simulation also briefly prioritizes an interesting discovered skill. Interpret scheduling in context: complete the configured assessment while briefly exploring useful discoveries, not by blindly hard-coding a priority list that contradicts conversational behavior.

Useful failure tests: duplicate jobs, older responses arriving after newer responses, invalid JSON, unknown skills, disappearing sessions, empty recent transcript, and a genuine candidate answer that mentions several skills.

## 4. Discovered skills

An interviewer may notice a relevant skill not in the assessor's original configuration (for example, micro-frontend architecture). Probe it briefly—PRD 01 suggests **2–3 exchanges maximum**—then naturally return to configured skills. Discovered skills should not silently overwrite configured assessments, inflate coverage, or dominate limited interview time.

## 5. Portfolio: proficiency is not confidence

For each configured and discovered skill, generate:

- an L1–L5 proficiency level based on applicable behavioral anchors;
- **2–3 revealing candidate statements where genuinely available**;
- confidence as a separate field;
- a concise competency summary describing demonstrated patterns, limits, and missing evidence.

For configured skills, use their skill-specific behavioral anchors. For discovered skills, PRD 01 specifies universal L1–L5 anchors. Do not award a level based on a single impressive phrase, vocabulary, the AI interviewer's own words, or unsupported inference.

PRD 01's suggested confidence rule is:

- **high:** `probe_count >= 3` **and** state `covered`;
- **medium:** `probe_count = 2` **or** state `partial`;
- **low:** `probe_count <= 1` **or** state `initiated`.

The source's predicates overlap (for example, a three-probe `partial` skill matches medium). If implementing this rule, explicitly define precedence and add tests; do not let inconsistent branches silently manufacture high confidence. If evidence is insufficient, show the limitation rather than marking missing data as low proficiency.

### Evidence integrity

Verbatim quotes must actually occur in candidate transcript turns. Do not use AI-spoken statements as candidate evidence, turn a paraphrase into a fake quote, attach evidence to the wrong skill/speaker, or output a plausible but invented achievement. Preserve traceability to the underlying turn when practical. Validate malformed or partial model responses before persistence and presentation.

## 6. Fit/gap and assessor control

Fit/gap compares observed candidate levels with expected vacancy levels. The skill comparison (`match`, `gap`, `exceed`, `not_assessed`) should remain deterministic where feasible; an LLM may produce a separately identified narrative, not redefine the numeric comparison. A recruiter should see the evidence, level, confidence, unassessed areas, and any human overrides without treating model judgments as unquestionable facts.

## 7. Session reliability

Live audio and transcript flow depend on browser microphone permissions, AudioWorklet, browser/backend sockets, Gemini Live, persistence, and async jobs. Test denial, browser refresh, temporary disconnection, duplicated transcript events, model timeouts, and session-end races.

PRD 02 describes transparent Gemini `GoAway` handling using the latest session-resumption handle and reconnecting before the old socket closes. Preserve context, transcript ordering, coverage state, and candidate continuity where possible. Report any degradation clearly; never silently pretend an interrupted interview completed normally.

## 8. Candidate impact and privacy

A candidate cannot choose the assessment tooling but may be materially affected by its output. Design for them as well as recruiters and assessors. Important safeguards include accurate evidence attribution, explicit uncertainty, incomplete-assessment visibility, protected personal data, secure tenant separation, access controls, and appropriately scoped logging. Consider the brief's UU PDP concerns; do not claim legal compliance merely because these safeguards exist.

## 9. Technical guardrails around models

Use AI for semantic reasoning where appropriate (understanding replies, classifying evidence, generating a narrative); use ordinary code for rules that must be deterministic (state constraints, schema validation, score comparisons, authorization, retry/idempotency, output enums). Treat Gemini results as untrusted external data. Validate input/output schemas, missing fields, IDs, value ranges, and partial failures.

Do not make a high-impact decision from `nil`, missing ratings, a single quote, a stale map, or an unfinished session as though all skills were thoroughly assessed.

## 10. Product-focused QA examples

- A vague claim gets a follow-up requesting concrete evidence, not generic encouragement or the next question.
- A strong answer triggers proportionate probing, not automatic skill completion.
- A skill with only one meaningful exchange remains `initiated` even if the answer was exceptional.
- `partial → covered` requires both sufficient probing and defensible behavioral evidence.
- Unrelated or hallucinated portfolio quotes are rejected or clearly flagged.
- When a skill was never assessed, its absence is visible rather than converted into an L1 rating.
- Delayed analyzer results cannot regress a newer coverage state.
- An assessor can understand the relationship between quote, level, confidence, vacancy requirement, and narrative.
- Loading, empty, error, long-text, mobile/responsive, and reconnecting states remain usable.

For a new feature or bug fix, select the relevant examples and turn them into observable acceptance criteria and automated tests where practical.
