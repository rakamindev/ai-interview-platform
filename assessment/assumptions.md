# Assumptions & Ambiguities

> The brief, section 6: *"No Live Q&A: Make reasonable assumptions, document them
> in your PDF report, and proceed."*
>
> Every ambiguity found and recorded here is a point scored, not a complaint.
> The invitation email states: *"We truly value candidates who pay close
> attention to detail."*

Format: **ID — the ambiguity — the assumption I made — why it is reasonable.**

---

## Process ambiguities

**A1 — Conflicting deadlines.**
The brief PDF states *"Wednesday 19 August, 13:00 WIB"*; the invitation email
states *07 September 2026, 08:00 AM*. The PDF's own metadata shows it was created
18 August 2026, so its deadline refers to an earlier cycle and is stale.
→ **Assumption:** the email deadline governs. Work is delivered against 7 Sept 08:00 WIB.

**A2 — Conflicting submission channels.**
The email says *"Submit the case study to this email."* The brief says
*"Upload a single PDF document in the hiring platform portal."*
→ **Assumption:** do both. The cost of a duplicate submission is zero; the cost of
missing the intended channel is the whole assignment.

**A3 — Pull request target.**
The brief asks for a PR on `github.com/rakamindev/ai-interview-platform`, a
repository I do not have write access to.
→ **Assumption:** fork → feature branch → PR opened against `rakamindev:main`,
left **open** (not merged) so reviewers can read the diff and the description.

**A4 — Deliverables folder.**
`README.md` says *"Work in the `/assessment` folder at the repo root for your
written deliverables"*, but that folder does not exist in the repository.
→ **Assumption:** create it. Written deliverables live there; code changes stay in
`api/` and `web/`.

---

## Documentation defects found during setup

These are findings in their own right, not just obstacles. They belong in the
gap analysis as low-severity but real developer-experience debt.

**A5 — `api/README.md` step 7 instructs `cd ../ai-interview-web`.**
No such directory exists; the frontend lives in `web/` inside this same repo.
The README predates the merge of the two services into one repository.

**A6 — Frontend default API port is wrong in two places.**
`web/README.md` states the backend default is `http://localhost:3000`, and
`web/.env.example` ships `VITE_API_BASE_URL=http://localhost:3000/api/v1` and
`VITE_WS_BASE_URL=ws://localhost:3000`. The API actually serves on **3001**
(`api/README.md` step 6, and `APP_BASE_URL` in `config/application.yml.sample`).
A new engineer following the README verbatim gets a silently broken app: the UI
renders, every request fails.

**A7 — `application.yml.sample` ships `ALLOWED_ORIGINS: "*"`.**
The sample configuration a developer is told to copy disables CORS origin
restriction by default.

---

## Scope assumptions

**A8 — Live audio interview is out of scope for the shipped change.**
Exercising the Gemini Live path requires a preview model, an API key with quota,
and a working microphone pipeline. It cannot be asserted on in an automated test.
→ **Assumption:** the change is delivered on the post-interview decision surface
(portfolio → assessor override → fit/gap → export), which is fully testable and
is where a wrong result actually reaches the candidate. The live path is
time-boxed to one hour of manual exploration; if it does not run, that is recorded
as a constraint rather than chased.

**A9 — No reproducible demo data exists.**
`api/db/seeds.rb` seeds only the organization and the 22-skill taxonomy. There is
no seeded assessment, session, transcript, portfolio, or vacancy, so the
assessor's review screens cannot be opened without first burning a live Gemini
session.
→ **Assumption:** a deterministic demo seed reproducing the PRD-02 scenario is
in scope, both as a prerequisite for this work and as a genuine contribution.
All seeded candidate data is **fictional** — no real personal data enters the
repository (UU PDP, and the brief's disqualifier on committing real personal data).

---

## Specification source

**A10 — The wiki is treated as the product specification.**
`README.md` points to `github.com/rakamindev/ai-interview-platform/wiki` for the
*"initial product specification"*. It contains PRD-01 (AI interview behavior,
including the exact N7 analyzer and N10 portfolio prompts) and PRD-02 (an
end-to-end reference simulation).
→ **Assumption:** these are the written spec. This is what makes it possible to
separate *missing specification* from *defective implementation* as Step 3
requires — without them, that distinction would be guesswork.

**A11 — The published specification is an extract, and two pipeline nodes it
implies are defined nowhere.**

The PRDs and the source both identify pipeline steps with a node notation:
`N` for a backend pipeline step, `U` for a user-facing screen, `B` for a shared
building block. The legend itself is never stated — it has to be inferred from
usage.

Across both wiki pages the following are defined: N1, N2, N4, N5, N6, N7, N8,
N9, N10, N11, N13, N14, plus B6, B7, U5, U7, U10. Searching `api/`, `web/` and
both PRDs for **N3** and **N12** returns nothing at all, yet the numbering
implies both exist.

A second, smaller inconsistency: only 7 of the 12 defined nodes are tagged in
the source (`# N2`, `# N5`, `# N7`, `# N9`, `# N10`, `# N13`, `# N14`). N1, N4,
N6, N8 and N11 are implemented but carry no tag, so spec-to-code traceability
works for roughly half the pipeline. N8 is a particular case: the PRD documents
coverage map injection under the label **B6**, while PRD-02's runtime trace calls
the same step **N8** — one mechanism, two identifiers.

→ **Assumption:** the wiki holds an *extract* of a larger internal design
document rather than the whole thing (`Home.md` is an empty placeholder, and only
two pages exist). N3 and N12 are treated as **out of scope and unknowable** — I
do not guess at what they were meant to do, and I do not assume their absence is
a defect.

→ **Impact, and why this is a finding rather than a footnote:** this is
*missing specification* in its purest form. Nothing is broken; something was
never written down. An engineer inheriting this codebase cannot determine whether
N3 and N12 were cancelled, deferred, renumbered, or simply omitted from the
published extract — and cannot tell whether an unlabelled piece of code is one of
them.

→ **Escalation (constraint signal):** on a live project this is a day-one
question for the Technical Lead, not something to resolve by guessing:
*"N3 and N12 are implied by the numbering but defined nowhere — were they
dropped, or is the published spec partial? And should the coverage-injection step
be referred to as B6 or N8?"* Asking costs one message; guessing wrong costs a
sprint.

---

## Role definition

**A12 — The role being assessed is named differently in the two documents I was given.**
The invitation email refers to the *"Frontend/Backend Engineer Intern position"*,
which is the role I applied for. The brief attached to that email is titled
*"Case Study: Fullstack Product Engineer"*, and its section 1 is headed
*"We Are Hiring a Product Engineer"* — a framing it then spends a page
distinguishing from a conventional software engineer.
→ **Assumption:** the brief governs, because it is the document that defines
what is being assessed and it is unusually explicit about the distinction being
deliberate. All written deliverables therefore say *Fullstack Product Engineer*.
→ **Why it changed what I did:** this was not a labelling question. The brief's
framing is what led me to spend the first hours on the wiki PRDs and on deciding
*which* problem was worth solving, rather than on picking the largest technical
change I could implement. A conventional engineer would have optimised for lines
of code; the brief explicitly says the opposite is wanted.
