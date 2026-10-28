# AI verification moments (selected)

Five moments where code or evidence produced with the AI assistant was wrong or risky, chosen because the risk was real (wrong data, security, false evidence), the way it was caught can be repeated, and the fix is visible in a commit or test. The full list (70 entries) is in `log-bukti.md`.

## 1. The most important cross-tenant attack was not covered by the first tests

| | |
|---|---|
| What the AI produced | Request specs for tenant isolation where the intruder (organisation B) called `POST /portfolios/:id/fitgap` with a vacancy owned by organisation A. |
| Risk | The leak proven in Step 1 used the intruder's own vacancy against A's portfolio. With A's vacancy the request already returned 404 because the vacancy lookup was tenant scoped, not the portfolio lookup, so the spec would have passed while the real attack still worked: a false sense of security on a P0 (UU PDP Pasal 46 breach). |
| How it was caught | The first red run showed `fitgap` and `regenerate_fitgap` as "passing" for the intruder, which contradicted the Step 1 evidence. Comparing the spec setup with the original reproduction showed the different vacancy. |
| Fix | Two examples added: "intruder pairing their own vacancy with another organisation portfolio" for both endpoints; both proven red (202) before the fix. |
| Evidence | `1670e37` (specs, red), `4a2245a` (fix). The same two examples caught seeded fault 2 in CI run 40311288476. |

## 2. A claim timeout almost based on a wrong assumption about retries

| | |
|---|---|
| What the AI produced | The assumption that Faraday retries a timed-out Gemini call up to three times, so a single generation could take about 4 x the timeout and the job claim window would need to be much longer. |
| Risk | A claim window that is too long keeps a crashed job "generating" for many minutes; one that is too short lets two workers generate the same portfolio. Either way the visible status would be wrong. |
| How it was caught | Before writing the constant, the `faraday-retry` source was read: it only retries idempotent methods, and `generateContent` is a POST, so it is never retried. |
| Fix | `CLAIM_TIMEOUT = 2 * GEMINI_TIMEOUT`. The dead retry configuration was recorded as a separate finding (N16) instead of being "fixed" silently. |
| Evidence | `ec906bb` (`Portfolios::Generator::CLAIM_TIMEOUT`), finding N16 in `01-setup-dan-eksplorasi.md`. |

## 3. A "green" run that was actually testing the old code

| | |
|---|---|
| What the AI produced | A report that the new PDF generator specs passed. |
| Risk | Claiming a fix that was not there: the PDF is the document a hiring manager receives. |
| How it was caught | The write of the new generator had been blocked by a hook, and the spec output still referenced `pdf_generator.rb:84 render_skill_card`, a method that only existed in the old code. |
| Fix | The run was relabelled as the red baseline, the new generator was written, and the specs were run again against the new file. |
| Evidence | `c5d7f9e` (specs) then `e14354a` (fix); log entry 29. |

## 4. A heading level that passed in jsdom but could not be proven in Chrome

| | |
|---|---|
| What the AI produced | `aria-level="4"` on the Radix accordion `h3` to nest "Evidence" headings under each skill's `h3`. |
| Risk | The component test passed (jsdom reads `aria-level`), but a screen reader user would still meet a flat list of `h3`s. An accessibility claim in the report would have rested on a test environment, not the browser. |
| How it was caught | The Chrome accessibility snapshot did not show level 4, so the claim could not be verified. |
| Fix | `AccordionTrigger` gained a `headingLevel` option that renders a real `h4` through Radix `asChild`; checked in the Chrome DOM (`H4` under the skill `H3`). |
| Evidence | `a584b22` (test), `d7be01e` (fix). |

## 5. A reproduction test that passed on the old, broken code

| | |
|---|---|
| What the AI produced | A test meant to reproduce the empty edit form overwriting a vacancy: after a failed load, fill the role title and press Save, then expect no update request. |
| Risk | The test is evidence for a P1 data-loss finding (N18). If it passes on the old code, the commit history "proves" a bug that the test never exercised. |
| How it was caught | Building the commits in a worktree, the intentionally red test commit reported "4 failed, 1 passed". The old label had no `htmlFor`, so `queryByLabelText` found nothing and the Save step was skipped. |
| Fix | The test uses the first text box instead; the commit builder now prints the name of every failing test, and every red commit is checked by name (or with stubs when a file fails only at import). |
| Evidence | `b1522ce` (test, 5 of 5 red by name), `68d79e0` (fix). |
