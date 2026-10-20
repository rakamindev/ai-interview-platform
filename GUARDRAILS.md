# Guardrails

Rules for anyone changing this repo during the case study, whether a person or an AI assistant. They come from
two places: the brief's disqualifiers (break one and the submission fails), and practices learned while working here,
each with the incident that taught it.

When a rule and a deadline conflict, the rule wins. When a rule seems wrong for a situation, raise it; don't
quietly work around it.

## 1. Hard rules (disqualifiers)

| Never | Instead |
|---|---|
| Weaken, skip or delete a test assertion to make it pass. | Fix the code. If the test is wrong, say why in the commit message and change it in its own commit. |
| Commit secrets: `api/config/application.yml`, `web/.env`, API keys, JWTs, `SECRET_KEY_BASE`. | Keep them local (they're gitignored). Check `git diff --cached` before every commit. |
| Commit real personal data: names, emails, voices, transcripts of real people. | Use synthetic data only, in specs, seeds, screenshots and evidence. |
| Commit code you can't explain line by line. | Rewrite it until you can. There's a live technical defense. |
| Test only the happy path. | Every change has tests for its failure paths (see section 4). |
| Copy someone else's work without attribution. | Credit the source in the code comment and the PR. |
| Ship UI that's only correct in the ideal state. | Cover loading, empty, error, partial, long text and 375px (see section 6). |

## 2. Git and branches

- **Never commit to `main`.** Work on a feature branch, in small commits that each do one readable thing.
- **The branches are stacked.** Each one contains the ones before it (see the work log). Fix a finding on the
  branch it belongs to, then rebase the branches above it with `git rebase --update-refs`.
- **Force-push only to `origin`** (`mwyzer/ai-interview-platform`, private), only with `--force-with-lease`, and only
  before a PR exists for that branch. **Never force-push to `upstream`** (`rakamindev/ai-interview-platform`).
- **The final PR goes to `upstream`**, opened by the candidate.
- **After a rebase, update the commit hashes in the work log.** They go stale silently.
- Commit messages say *why*, not only *what*. Commits made with an AI assistant end with its `Co-Authored-By` line.

## 3. Data, migrations and the API

- **Migrations are reversible and safe for existing rows.** Relax constraints and add nullable columns; don't
  rewrite stored values. A rollback that would lose information stops with a clear message instead of inventing
  data.
- **Don't rewrite past ratings.** People may have acted on them. Changing them is a product decision, not a
  migration side effect.
- **Every query on tenant data is tenant-scoped.** A plain `Model.find(params[:id])` on a tenant model is a bug
  (Step 3, P0-2). Unscoped access needs a comment explaining why it's safe.
- **Validate every input**, especially model output. Treat a model response like user input: parse it strictly,
  never clamp a bad value into range (Step 3, P0-1).
- **Never turn missing evidence into a score.** "Not assessed" is a valid result; L1 is a claim.
- **Writes that must succeed together run in one transaction**, and slow calls (the model) happen before the
  transaction opens.
- **Unauthenticated endpoints get extra scrutiny.** Anything reachable with only an invite token must not let the
  holder change results or end sessions on someone's behalf (Step 3, P1-10).

## 4. Tests

- **Watch every new test fail first**, against the unfixed code, and check that it fails on its assertion and for
  the stated reason, not on a setup error. A `pending` spec accepts *any* failure, so a broken factory looks exactly
  like proof (AI verification moment 5).
- **`pending` (API) and `it.fails` (web) mean a known defect.** Each pins one finding from Step 3. When the fix
  lands, the test starts failing; remove the marker in the same commit as the fix. Both accept *any* failure, so
  check each one by running it as a normal test and reading why it fails (AI verification moments 5 and 7).
- **Unit tests sit beside their source** (`foo.ts` → `foo.test.ts`; API specs mirror `app/` under `spec/`).
  Integration tests live in `api/spec/integration` and `web/src/test/integration`; functional tests in
  `api/spec/functional` and `web/src/test/functional`.
- **Never push test jobs to the real Redis.** The dev Sidekiq shares it and would run them against the dev
  database, possibly calling Gemini. Use `Sidekiq::Testing` (fake or inline).
- **Tests that touch a running service are opt-in and clean up after themselves.** The web contract test only
  creates what it can delete, and never starts or ends a session.
- **Web tests fake only the network**, at the HTTP level (MSW). Don't mock the app's own services or components.
  A request without a handler fails the test; add a handler rather than loosening that check.
- **Specs never call Gemini.** Use `spec/support/fake_gemini.rb`. Tests that need the network aren't tests.
- **Cover the failure paths:** model timeout, invalid JSON, missing fields, out-of-range and wrongly typed values,
  partial writes, duplicate jobs, very long text.
- **Seeded fault test:** before the PR, break the logic on a scratch branch, show the suite catch it, revert, and
  keep the history visible.
- Run the suite with the commands in the README before every push.

## 5. Privacy and logs

- **No personal data in logs.** Passwords, assessor notes and transcript text must be filtered (Step 3, P1-7).
- **Never send real candidate data to the Gemini free tier.** Its terms forbid personal information and allow human
  review of inputs. Production must run on a paid tier (Step 2, Pillar 5).
- **Errors shown to users or stored in the database carry a category and a safe message**, never raw exception
  text or model output.
- Design for the candidate, who never chose this tool: tell them before, not after; and never penalize them silently
  for an option the product offered (Step 2, Pillar 5).

## 6. UI

- Use the existing design system (`web/src/components/ui`, Tailwind tokens). No new visual language.
- Every screen handles **loading, empty, error (with a way out), partial, long text and 375px**, with no horizontal
  scroll.
- State is never shown by color alone. Interactive elements are reachable and usable with a keyboard.
- Never show something the system doesn't know as if it did: no level badge for a skill nobody assessed.

## 7. Working with AI assistants

- **AI output is a draft.** Read generated code before running it, and run it before trusting it.
- **Verify with a real request, not a status.** "Container Up" didn't mean the API was running (AI verification
  moment 2). An empty queue didn't mean no duplicate jobs (moment 3).
- **Log every case where AI output was wrong or risky** in the work log's "AI verification moments": what it
  claimed, how it was caught, what changed. They're required material for the report.
- An assistant doesn't push to `upstream`, open PRs, delete branches or force-push without the candidate's
  explicit go-ahead for that specific action.

## 8. Writing the deliverables

- Deliverables live in `/assessment` and are written in English.
- **Findings** follow the brief's format: severity (P0–P3), a one-line impact, and whether it's a missing
  specification or a defective implementation, with reproducible evidence.
- **Label assumptions as assumptions.** There's no live Q&A, so every unverified claim says so.
- **Cite sources** for laws, statistics and third-party terms, and quote article numbers exactly.
