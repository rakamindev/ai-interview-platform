# AI verification log

This document records how AI was used during this assessment and, more
importantly, how its output was checked. It is written on the assumption that an
AI-assisted report is only as trustworthy as its verification trail.

---

## 1. Evidence labels

Every claim in this assessment carries exactly one label. The labels are not
decoration; they encode what would have to be false for the claim to be wrong.

| Label | Means | How it was earned |
|---|---|---|
| `[VERIFIED-RUNTIME]` | Observed by running this application on this machine | A curl response, console output or screenshot exists in `evidence/` or `screenshots/` |
| `[VERIFIED-CODE]` | Read directly in source | File and line are quoted in `findings.md` |
| `[HYPOTHESIS]` | Reasoned but not observed | The claim states what would prove or disprove it |

Two rules were enforced throughout. A label was never upgraded without new
evidence being committed alongside it. And labels attach only to claims about the
system — never to introductions, section headings or process notes, because a
label on a sentence that cannot be false is a label that means nothing.

## 2. How AI was used

AI was used for source reading at volume, for hypothesis generation, for drafting
prose, and for producing the migration and acceptance-criteria drafts. It was not
treated as an oracle. Three practices did the actual work:

**Hypotheses were run, not accepted.** The application was brought up locally —
Postgres 16 and Redis via Homebrew, Rails on 3001 in single-process mode, Vite on
5173 — specifically so that predictions could be executed. Four of the twelve
retractions below exist only because a prediction was tested against the running
product and failed.

**Schema and validations were read before behaviour was predicted.** Several
early hypotheses assumed data states that the database forbids. Checking
`null: false`, check constraints and model validations first eliminated a class of
plausible-sounding but impossible defects.

**Retractions were recorded rather than quietly deleted.** The list below is the
point of this document. A report that never withdraws anything has not been
verified; it has only been written.

## 3. Retraction log

Twelve claims were withdrawn or narrowed before publication.

1. **"A nil `skill_label` will raise `NoMethodError` in the fit/gap engine."**
   Disproved by `null: false` on the column plus a presence validation on the
   model. *Lesson: establish which data states are reachable before predicting an
   exception.*
2. **A migration draft made `ai_level` nullable without noticing that
   `assessor_overrides.ai_level` is also `null: false` with no `allow_nil` on its
   numericality validation.** Caught by reading `schema.rb` again rather than
   trusting the draft. *Lesson: a nullability change is a graph problem, not a
   column problem.*
3. **"The override endpoint is unreachable, because the role `assessor` does not
   exist in the `User` model."** Disproved by `application_controller.rb:12`,
   whose comment reads `# allows admin or assessor`; an admin passes the guard.
   The finding survived only in the far weaker form of three inconsistent role
   vocabularies. *Lesson: read what an authorization check does, not what its
   argument is called.*
4. **"The JWT tenant claim is `tenant_id`."** It is `scheme`. Disproved by reading
   `authentication_controller.rb`. *Lesson: decode the actual claim rather than
   the expected one — every downstream conclusion depended on this name.*
5. **"The wrong API port is a README typo."** [VERIFIED-RUNTIME] It is in
   `web/.env.example` itself, which ships `localhost:3000` while the API serves
   3001. This is a shipped-configuration defect, not a documentation defect, and
   the severity rose accordingly. *Lesson: a claim can be wrong by being too
   generous.*
6. **"The fit/gap path is `/portfolios/1/fitgap?vacancy_id=1`."** The server
   returned `No route matches [GET] "/api/v1/portfolios/1/fitgap"`. The real shape
   is POST to generate with a JSON body, GET with the vacancy id as a **path
   segment**. *Lesson: read `rails routes`; never guess a route.*
7. **"Skills configured for the interview but omitted by the model are silently
   dropped from the fit/gap report."** [VERIFIED-RUNTIME] Disproved: `SK-PM-005`
   is returned as a correct `not_assessed` row with `candidate_level: null`,
   `delta: null` and `confidence: null`. **This retraction produced the strongest
   argument in the report.** The vocabulary for "unknown" already exists and is
   already correct at the API layer; only the parsing and persistence path cannot
   reach it. The proposal became a consistency fix rather than a new feature.
8. **"`delta: 0` is falsy in JavaScript, so a Match row will render as missing
   data."** [VERIFIED-RUNTIME] Disproved by looking at the rendered page:
   `✅ Match` displays correctly, because the falsy check only guards the numeric
   suffix. The corresponding acceptance criterion was withdrawn. *Lesson: a real
   language pitfall is not automatically a real bug.*
9. **"There is no way to reach the fit/gap report by clicking."** [VERIFIED-RUNTIME]
   Disproved: Portfolio Results carries a `Choose vacancy…` select and a
   `Run Fit/Gap Analysis →` button. The finding was deleted entirely, in every
   form. It had been inferred from the route table in `App.tsx` instead of from
   the running application — which is precisely the error this report accuses the
   system of making. *Lesson: `[VERIFIED-CODE]` is not `[VERIFIED-RUNTIME]`, and
   this entry is why the distinction exists.*
10. **"There is no session list in the interface."** Narrowed before publication:
    `AssessmentInvitePage` serves that purpose, listing candidates with status and
    a `Results` action. *Lesson: absence is the hardest thing to verify.*
11. **"Detailed exception traces leak to clients."** Raised from a 27-frame JSON
    stack trace in a 404 response, then retracted:
    `config/environments/production.rb:13` sets
    `consider_all_requests_local = false`. Development-only behaviour, not a
    finding. It appears in `findings.md` as a positive instead. *Lesson: check the
    environment before reporting an environment-dependent observation.*
12. **"Model-discovered skills are dropped from the fit/gap report."**
    [VERIFIED-RUNTIME] Narrowed: the page does render a
    `Discovered Skills (not in vacancy requirements)` block from a separate
    portfolio fetch. The accurate claim is that discovered skills are absent from
    `skill_comparisons`, the footer counts, the narrative and the JSON export, and
    that the on-screen rendering strips the badge, the confidence colour, the
    caveat banner and the evidence quote down to the string `3 (low confidence)`.
    *Lesson: the interface reads from more than one endpoint; a payload does not
    define a screen.*
13. **"Tenant resolution reads the `scheme` claim before the signature is
    verified."** [VERIFIED-RUNTIME] Disproved. With a control line confirming
    `len=153` for the token variable and a valid request returning 200, the same
    token with a corrupted signature returned **401**, not 403. Signature
    verification precedes tenant resolution. No finding is claimed; see
    `evidence/tampered-token-outcome.txt`.

    The first attempt at this test was **discarded**, and that matters more than
    the result. Its control line returned `valid 403`: `$TOKEN` had not survived
    a shell paste that aborted mid-command, so every request carried an unusable
    credential and the tampered request appeared to return the tenant message.
    Read without the control line, that run would have been taken as confirming
    the hypothesis and would have escalated a P0 finding on the strength of a
    broken shell variable. *Lesson: a test needs a control that fails loudly when
    the instrument is not connected — without `valid 200`, the interesting number
    means nothing.*

## 4. What was not verified

Stated plainly, because a verification log that lists only successes is a
marketing document.

- The response code for an unauthenticated request is confusing but not a
  bypass: an empty Bearer value yields 403 with a tenant message rather than
  401, because the tenant lookup reports the missing scheme instead of the
  missing credential. Worth fixing for diagnosability; not a security finding.
- No real interview was ever conducted, so the live WebSocket path and the
  `/sessions/:id/coverage` endpoint are unverified. The coverage endpoint returns
  empty arrays with `updated_at: null` for a completed session; because its data
  source could not be confirmed, **no defect is claimed for it**.
- `GEMINI_API_KEY` was empty throughout. Every narrative observed is a fallback
  narrative, and the parsing defect is proved from source plus reproducible
  `String#to_i` behaviour rather than from an observed malformed model response.
- The API ran in single-process mode, because cluster mode fork-crashes on macOS.
  Nothing about cross-worker state can be verified from this machine.
- The `PDF` and `JSON` export buttons on the fit/gap page were not exercised.

## 5. Authored data disclosure

The `portfolio_skills` rows used in every screenshot were created by
`api/db/seeds_local.rb`, written for this assessment because `db/seeds.rb`
produces no domain data. The competency summary strings — including *"Not covered
during the interview."* and *"Model returned a non-numeric competency level."* —
were authored to label each row's intent and were **not** produced by the system.

What the screenshots therefore prove is **rendering behaviour**: given a row with
`ai_level = 1`, `ai_confidence = 'high'` and `evidence = []`, the interface
presents `L1 / Foundational` at `HIGH` confidence and omits the evidence section
with no indicator. That the state is reachable in production is established
separately, from `to_i.clamp(1, 5)` and from the absence of any validation tying
confidence to evidence.
