# AI Verification Log

> Required by the brief, Step 5: *"AI Verification Moment: Document at least one
> instance where AI code generation was wrong or risky and how you
> verified/corrected it."*
>
> **Fill this in as it happens.** It cannot be reconstructed afterwards, and a
> reconstructed one reads as fabricated. One honest entry beats five invented ones.

AI tooling used: Claude (Claude Code) as a pair engineer and reviewer.
Verification stance: every claim the model makes about this codebase is treated
as a **hypothesis** until confirmed against the running system, the database, or
a failing test.

---

## Entry template

### VER-00 — <short title>

- **Date / stage:**
- **What the AI claimed or generated:**
- **Why it was wrong or risky:** (be specific — wrong assumption? plausible but
  unverified? correct code, wrong context? silently unsafe?)
- **How I detected it:** (ran it? read the source? wrote a test? checked the DB?)
- **Evidence:** (command output, file:line, screenshot, failing test name)
- **What I changed as a result:**

---

### VER-01 — AI generated an install command that would have broken the system's compression library

- **Date / stage:** 2026-09-06, Step 1 (environment setup, before any code was written).
- **What the AI claimed or generated:** a package install command for my machine —
  `sudo pacman -S --needed postgresql redis mise openssl zlib libyaml libffi readline gmp`
  — presented as the first step of setup, with no caveat about my distribution.
- **Why it was wrong or risky:** it assumed vanilla Arch Linux package names. I run
  **CachyOS**, an Arch derivative that ships `zlib-ng-compat` (a faster zlib fork)
  as the system compression library instead of `zlib`. Naming `zlib` explicitly
  asked pacman to *swap* the system library, not to install a missing one.
  `pacman -Qi zlib-ng-compat` shows it is `Required By` ~120 packages including
  `gcc`, `curl`, `python`, `openssl`, `sudo`, `postgresql-libs` and the kernel
  headers. Had the swap gone through unnoticed, the blast radius would have been
  most of the toolchain I need for the rest of this assignment.
- **How I detected it:** I ran the command instead of trusting it, and read the
  failure rather than skimming it. Package management refused the transaction:

  ```
  :: zlib-1:1.3.2-3.1 and zlib-ng-compat-2.3.3-2 are in conflict. Remove zlib-ng-compat? [y/N] y
  error: failed to prepare transaction (could not satisfy dependencies)
  :: removing zlib-ng-compat breaks dependency 'zlib-ng-compat' required by lib32-zlib-ng-compat
  ```

- **Evidence:** `pacman -Qi zlib-ng-compat` reports `Provides : zlib  libz.so=1-64`,
  and both `/usr/include/zlib.h` and `/usr/lib/libz.so` are already present. The
  dependency the AI wanted to install was **already satisfied** under a different
  package name. Of the nine packages requested, six were already installed and
  one was actively harmful; only three (`postgresql`, `valkey`, `mise`) were needed.
- **What I changed as a result:** dropped `zlib` from the command entirely and
  installed only what was actually missing. More durably, I changed how I treat
  environment commands: I now verify what a dependency *resolves to on this
  machine* (`pacman -Qi <pkg>`, `command -v`) before running an install that
  removes anything, rather than accepting a generated command as portable.
- **Transferable lesson:** the AI produced advice that was correct for the
  *average* Linux machine and wrong for *mine*. That is the characteristic
  failure mode of generated setup instructions — plausible, well-formed, and
  silently assuming a context it was never given. The safeguard was not a better
  prompt; it was running the command in an environment that fails loudly, and
  reading the error instead of retrying past it.

---

### VER-02 — AI wrote a pluralisation helper that was wrong, and a test that could not catch it

- **Date / stage:** 2026-09-06, Step 5 (implementation of the fit/gap fix).
- **What the AI generated:** a `pluralize_count(count, singular, plural = nil)`
  helper for the fit/gap fallback narrative, which defaults the plural form to
  `"#{singular}s"`, plus the call sites that use it:
  `pluralize_count(matches, 'skill meets')`.
- **Why it was wrong:** the phrase being pluralised is a **verb phrase**, not a
  noun. Suffixing `s` produced *"3 skill meetss the required level"*. The plural
  of "skill meets" is "skills meet" — the inflection moves from the verb to the
  noun, which no suffix rule can express.
- **Why the accompanying test did not catch it:** the AI also wrote the spec, and
  the spec asserted only the **singular** branch —
  `expect(summary).to include('1 gap')` with exactly one gap in the fixture. The
  helper's default plural path was never executed by any example, so the suite
  was green while the output was ungrammatical. A test written by the same pass
  that wrote the code inherits the same blind spot.
- **How I detected it:** not from the test suite, which was green. I regenerated
  a real report against the development database and read the resulting sentence:

  ```
  narrative: Rule-based summary only: 3 skill meetss the required level, 1 skill exceeds it, ...
  ```

- **What I changed as a result:** passed explicit plural forms at every call site
  (`'skill meets', 'skills meet'`), rewrote the helper's comment to state that a
  phrase whose plural is not simply `+s` must supply it, and added a **second**
  example that exercises a count above one and asserts
  `not_to match(/meetss|exceedss|gapss|wass/)`. The suite went from 19 to 20
  examples. Re-running the generator confirmed the corrected sentence.
- **Transferable lesson:** a passing suite is evidence about the branches the
  suite reaches, and nothing more. When the same author writes both the code and
  its test, the test tends to assert what the code happens to do rather than what
  correct behaviour is. Reading real output remained necessary — and here it was
  the *only* thing that surfaced the defect.

---

### VER-03 — AI created a file containing a live credential that the repository would not have ignored

- **Date / stage:** 2026-09-06, Step 5, immediately before the first commit.
- **What the AI did:** while installing a working `VITE_DEV_TOKEN` into
  `web/.env`, it took a backup first — `cp web/.env web/.env.bak` — and did not
  check whether the repository ignores that path.
- **Why it was risky:** `.gitignore` shipped with `**/.env` and `**/.env.local`,
  neither of which matches `.env.bak`. The backup therefore sat in the working
  tree as an untracked-but-visible file holding a credential. `git add -A` would
  have staged it. Committing a secret is one of the brief's six non-negotiable
  disqualifiers, so this single file could have ended the submission regardless
  of the quality of everything else.
- **How I detected it:** by running a pre-commit check on what `git add` would
  actually stage, rather than trusting that `.gitignore` covers "env files":

  ```
  $ git add -A -n | grep env
  add 'web/.env.bak'
  $ git check-ignore -q web/.env.bak; echo $status
  1        # 1 = not ignored
  ```

- **Evidence:** `head -c 60 web/.env.bak` confirmed the file's content, and
  `grep -c VITE_DEV_TOKEN web/.env.bak` returned 1.
- **What I changed as a result:** deleted the backup, then widened the ignore
  rule from `**/.env` / `**/.env.local` to `**/.env.*` with an explicit
  `!**/.env.example` exemption, so editor and shell backups (`.env.bak`,
  `.env.save`, `.env.old`) are covered by the pattern rather than by whoever
  happens to be looking. Verified by creating a throwaway `.env.probe.bak` and
  confirming `git check-ignore` matched it while `.env.example` stayed visible.
- **Transferable lesson:** the danger was not the AI's edit to a gitignored file;
  it was the *side file* the AI created on the way there. Generated commands
  produce artifacts nobody asked about, and an ignore rule written for the
  obvious filename does not cover them. The check that caught it costs one
  command — and the file that gets committed is rarely the one you were editing.

---

### VER-04 — AI reported a responsive layout fixed without ever rendering it, and fixed the wrong layer

- **Date / stage:** 2026-09-06, Step 5, after the fit/gap change was committed.
- **What the AI claimed:** that finding F8 (the portfolio page unusable at mobile
  width) was resolved. It had changed Tailwind classes on two components —
  `ComparisonTable` and `SkillPortfolioCard` — run the Vitest suite, seen 25
  tests pass, and reported the finding fixed.
- **Why it was wrong:** two compounding errors.
  1. **The evidence was the wrong kind.** The tests run in jsdom, which performs
     no layout and never evaluates a media query. A green suite says nothing
     about whether a page reflows. Nothing in that evidence chain touched
     appearance at all.
  2. **The fix was at the wrong layer.** The real cause was the application
     shell: `AssessorLayout` set `h-14 flex items-center justify-between` with no
     `flex-wrap`, and its contents (brand, two nav links, tenant badge, Logout)
     have a combined min-content width wider than a phone viewport. Every page
     inherited that, so patching individual cards could not have fixed it. The
     AI worked from the two files it happened to be editing rather than from the
     rendered page.
- **How I detected it:** I opened the app in my own browser at a mobile width and
  saw that the navigation bar still broke and the vacancy selector still fell
  apart, then told the AI to stop inferring from CSS and look at the running page.
- **What changed as a result:** the AI drove headless Chrome against the running
  dev server, found the header as the actual cause, and fixed it plus four more
  instances of the same pattern (`PortfolioPage`'s `w-56` vacancy selector, two
  page header rows, three `w-40` select triggers). Verification is now a
  measurement rather than an assertion: every page reports
  `documentElement.scrollWidth == clientWidth` with zero elements extending past
  the viewport, below the `sm` breakpoint.
- **A second error surfaced during that verification, worth recording.** The AI's
  first headless screenshots were taken with `--window-size=390,900` and appeared
  to show buttons clipped and content pushed off-screen — which it began
  diagnosing as remaining overflow. Measuring `document.documentElement.clientWidth`
  showed **500**, not 390: headless Chrome clamps the layout viewport, so those
  screenshots were a 500px render cropped to 390px. The "clipping" was an
  artifact of the instrument. Had it not been measured, the next hour would have
  gone into fixing a defect that did not exist.
- **Transferable lesson:** two distinct failures, and the second is the subtler
  one. A passing test suite is evidence only about what the suite actually
  exercises — for layout, that is nothing. And a measuring instrument needs
  validating before its output is trusted as a finding: a screenshot is an
  observation, not a measurement, and this one silently disagreed with the
  viewport it claimed to represent.

---

### VER-05 — AI committed credential-shaped literals into CI, and a scanner caught them on the pull request

- **Date / stage:** 2026-09-06, Step 5, on opening the pull request.
- **What the AI generated:** the GitHub Actions workflow, including a Postgres
  service with `POSTGRES_PASSWORD: postgres` and an application environment with
  `SECRET_KEY_BASE: ci-secret-key-base-not-used-outside-ci` and
  `DB_PASSWORD: postgres`.
- **What happened:** GitGuardian's check on PR #116 failed —
  *"1 secret uncovered"*, a Generic Password in `.github/workflows/ci.yml` at
  commit `5ef60c4`.
- **Was it a real secret?** No. Every value was a throwaway literal for a
  container that exists for the length of one job and is destroyed with the
  runner. Nothing needs rotating.
- **Why it was still wrong.** A scanner cannot distinguish a throwaway password
  from a live one, and neither can a reviewer skimming a diff. Writing values in
  that shape trains everyone — humans and tooling — to expect and tolerate them,
  which is exactly how a real credential eventually slips through unremarked.
  The brief lists committing secrets among six non-negotiable disqualifiers, and
  "it was only a test password" is not a defence anybody wants to be making.
- **What I changed as a result:** removed the shape rather than suppressing the
  alert. The Postgres service now uses `POSTGRES_HOST_AUTH_METHOD: trust`, which
  is appropriate for a container reachable only from its own job network and
  eliminates the password entirely. `SECRET_KEY_BASE` is generated per run with
  `openssl rand -hex 64` written to `$GITHUB_ENV`, because the suite only needs
  a key that is internally consistent for the length of the job — no two runs now
  share one, and no literal is committed.
- **A second AI error, in the remediation itself.** Having fixed the file, the AI
  asserted that rewriting git history was the wrong call — the values were never
  live, so there was nothing to contain, and force-pushing an open pull request
  would cost review history for a cosmetic gain. That argument was coherent and
  it was wrong, because it rested on an unchecked assumption about how the
  scanner works.

  Re-running the check proved it. The finding still pointed at commit `5ef60c4`,
  unchanged, on a scan of 18 commits:

  ```
  1 secret were uncovered from the scan of 18 commits in your pull request.
  GitGuardian id 23444290 · Generic Password · 5ef60c4 · .github/workflows/ci.yml
  ```

  **GitGuardian scans every commit in a pull request, not the final state of the
  tree.** A literal committed once stays discoverable in that commit's blob for
  as long as the commit exists, which is the entire point of secret scanning —
  anyone who clones the branch can check out that commit. Fixing forward can
  never clear such a finding, and would have left a red security check on a
  submission that is graded in part on data safety.

- **What I actually did:** rewrote history. `git filter-branch --tree-filter`
  replaced `.github/workflows/ci.yml` with the hardened version in all ten
  commits that carried it, the branch was force-pushed, and the literal now
  appears in no commit reachable from the pull request. A backup ref
  (`backup/pre-filter`) was created first. The cost the AI was worried about was
  real but small here — the PR was minutes old with no review activity, and the
  branch lives only on a fork.
- **Transferable lesson:** two lessons, and the second matters more.

  First, the tooling did not find a leaked credential; it found a *habit* that
  produces leaked credentials. Treating the alert as a false positive and
  clicking past it would have kept the habit and lost the warning.

  Second — and this is the one I will carry — the AI reasoned confidently about
  a tool's behaviour without checking it, produced a well-argued conclusion, and
  was wrong. The tell was available: the finding named a commit hash, not a file
  state, and nobody read that closely until the check failed a second time. When
  an automated check disagrees with your model of it, the check is describing
  reality and the model is a guess.

---

## Open claims awaiting my verification

These are assertions the AI made that I have **not yet confirmed myself**.
Each one must end up either verified (moved to an entry above) or corrected.

| # | Claim | Source cited | Status |
|---|---|---|---|
| C1 | Fit/Gap "Required" column renders blank because the API sends `expected_level` while the UI reads `required_level` | `api/app/services/fit_gap/engine.rb:62` vs `web/src/components/fitgap/ComparisonTable.tsx:50` | ✅ **confirmed** — live payload carries `expected_level` on all six rows and no `required_level`; `screenshots/01-ui-before-fitgap.png` shows the Required header above six empty cells |
| C2 | The ✏ override marker can never appear; the API never sends `is_override` | `ComparisonTable.tsx:56,76` vs `fit_gap/engine.rb:58-66` | ✅ **confirmed** — a real override exists (Communication, AI L2 → assessor L3) and the engine uses it, yet the payload has no `is_override` and no ✏ renders |
| C3 | The PDF export renders the required level correctly, so the same data is right in one renderer and wrong in the other | `api/app/services/exports/pdf_generator.rb:128` | ⚠️ **partly** — the source reads `c['expected_level']`, which matches the payload, but I have not yet opened a generated PDF to see the rendered column |
| C4 | `advance_stale_partials` promotes `partial → covered` with no model confirmation, which later becomes `confidence: high` | `api/app/workers/coverage_analyzer_worker.rb:91-101`, `api/app/services/portfolios/generator.rb:98-101` | ⬜ unverified |
| C5 | An assessor in tenant A can override a portfolio skill belonging to tenant B | `api/app/controllers/api/v1/portfolio_skills_controller.rb:51` | ⬜ unverified — prove with a request spec |
| C6 | `db/seeds.rb` seeds only the organization and skill taxonomy — no assessment, session, transcript, portfolio, or vacancy | `api/db/seeds.rb` | ✅ **confirmed** — `git diff HEAD -- api/db/seeds.rb` is empty and the only record write in the file is `INSERT INTO public.organizations` (line 61) plus the 22 taxonomy rows |

> **How to verify C5 properly:** do not just read the code. Write a request spec
> that mints a JWT for tenant B and POSTs an override against a portfolio skill
> owned by tenant A. If it returns 2xx, the vulnerability is real and the spec is
> your evidence. That single test is worth more in the report than a paragraph of
> prose about it.
