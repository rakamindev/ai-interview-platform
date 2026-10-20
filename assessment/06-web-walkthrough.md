# Step 5: the web changes, step by step

The web half of the change, in the same shape as the [API walkthrough](05-api-walkthrough.md). Each section covers:
what the assessor saw before, where the fix lives, what happens on screen in what order, which tests prove it, and
what's still open.

Run the web tests (from the host, or inside the `web` container):

```sh
cd web && npm install --include=dev && npm test
```

Today: 149 passing, 22 expected to fail (`it.fails`, known defects outside this change), and 7 skipped without a live
API. To run one file: `npx vitest run src/test/functional/portfolio.test.tsx`.

| # | Change | AC | Sub-PR |
|---|---|---|---|
| 1 | A "Not assessed" badge with the reason, and a summary line ("2 of 3 skills weren't assessed") | AC-22..AC-25 | 2, 5 |
| 2 | Rating a skill the AI didn't rate requires a note | AC-20 | 5 |
| 3 | Error states with Retry, long text collapsed, readable at 375px | AC-26..AC-30 | 5 |

Screenshots of each state, at 1280px and 375px, are in [`report/screenshots/`](report/screenshots/).

---

## 1. "Not assessed", with the reason, and a summary line

**Before.**
- **P0-1:** a skill the AI couldn't rate showed as **L1**, with a confidence badge.
- **P2-11:** a `null` level crashed the portfolio page.
- **P2-5:** the fit/gap summary folded unknowns into the other counts.

The assessor had no way to tell "measured low" from "never measured".

**Where.**
- [`utils/constants.ts`](../web/src/utils/constants.ts):
  - `parseLevel` (:8) reads a level, and returns `null` when it can't.
  - `NOT_ASSESSED_REASON_LABELS` (:16) holds the reasons in plain language.
- [`NotAssessedBadge.tsx`](../web/src/components/portfolio/NotAssessedBadge.tsx): the neutral badge.
- [`SkillPortfolioCard.tsx`](../web/src/components/portfolio/SkillPortfolioCard.tsx): one skill on the portfolio page.
- [`PortfolioPage.tsx`](../web/src/pages/portfolio/PortfolioPage.tsx): `notAssessedSummary` (:21).
- [`ComparisonTable.tsx`](../web/src/components/fitgap/ComparisonTable.tsx): the fit/gap rows and their summary.

**Step by step, on the portfolio page.**
1. **Every level goes through `parseLevel`**
   ([constants.ts:8](../web/src/utils/constants.ts:8)). Only a whole level from 1 to 5 counts (`3`, `"3"`, `"L3"`);
   anything else, `null` included, gives `null`. It's the same rule as the API's `strict_level`, so the two sides
   can't disagree. Nothing throws on a missing level any more.
2. **The card picks the badge** ([SkillPortfolioCard.tsx:32](../web/src/components/portfolio/SkillPortfolioCard.tsx:32)).
   The level shown is the assessor's rating if there is one, otherwise the AI's. With neither, the card shows
   `NotAssessedBadge`: dashed, grey, and the words "Not assessed". It's deliberately not a level colour, so it never
   reads as a low score.
3. **No confidence without a level** ([:43](../web/src/components/portfolio/SkillPortfolioCard.tsx:43)): confidence
   describes the AI's rating, so there's none to show.
4. **The reason, in words, and what to do about it**
   ([:45](../web/src/components/portfolio/SkillPortfolioCard.tsx:45)). For example: "Not reached before the interview
   ended. Probe it in the next interview, or add a rating if you have evidence." The wording matches the API's PDF.
5. **The summary line comes before any single skill**
   ([PortfolioPage.tsx:21](../web/src/pages/portfolio/PortfolioPage.tsx:21), shown at :255).
   - It counts configured skills that have no level and no assessor rating yet: "2 of 3 skills weren't assessed. The
     interview ended after 6 minutes (ended by the candidate)."
   - It adds how the interview ended only when that can't contradict the result. `all_covered` is never repeated,
     because anyone with the invite link can send it (P1-10).
   - When every skill is rated, there is no line.

**Step by step, on the fit/gap page.**
1. A row whose result is `not_assessed` shows a dash under Candidate, and "— Not assessed" as its result
   ([ComparisonTable.tsx:71-75](../web/src/components/fitgap/ComparisonTable.tsx:71)).
2. Under the skill name, it gives the reason plus "probe it in the next interview". It also covers "Not part of this
   interview", for when the vacancy asks for a skill the assessment wasn't set up to cover.
3. The summary counts unknowns on their own line ("— Not assessed: 2 skills",
   [:107](../web/src/components/fitgap/ComparisonTable.tsx:107)), never as gaps (P2-5).
4. The Required column reads `expected_level`, and falls back to `required_level` for reports stored before sub-PR 4
   (P1-2, [:33](../web/src/components/fitgap/ComparisonTable.tsx:33)).

**Tests.**
- [`constants.test.ts`](../web/src/utils/constants.test.ts):
  - which values `parseLevel` accepts (:5);
  - P0-1 "does not turn an unreadable level into L1" (:27);
  - P2-11 "treats a missing level as no level instead of throwing" (:32).
- [`portfolio-components.test.tsx`](../web/src/components/portfolio/portfolio-components.test.tsx), "a skill the AI
  could not rate" (:99):
  - it shows "Not assessed" instead of a level or a confidence (:103);
  - AC-22 explains each of the three reasons in plain language and suggests probing it (:149).
- [`portfolio.test.tsx`](../web/src/test/functional/portfolio.test.tsx) (functional):
  - "says how many skills weren't assessed, and how the interview ended" (:131);
  - "doesn't repeat an end reason that contradicts the result" (:140);
  - P0-1 "never shows a level for a skill the AI could not rate" (:180).
- [`ComparisonTable.test.tsx`](../web/src/components/fitgap/ComparisonTable.test.tsx):
  - a dash, not a level (:38);
  - AC-25 ×2: the reason and the hint (:59), and "not part of this interview" (:66);
  - P2-5: unknowns counted in the summary (:87).

**Limits.** Levels still show as L1–L5 with the role's rubric; plain-language labels ("basic", "capable") aren't built
yet.

## 2. Rating a skill the AI didn't rate requires a note

**Before.** The only action was "Override rating", and an override of nothing made no sense. Rating an unassessed skill
put a level on the record with no evidence behind it and no trace of where it came from.

**Where.** [`OverridePanel.tsx`](../web/src/components/portfolio/OverridePanel.tsx). On the API side, the same rule is
enforced in `assessor_override.rb`, and `portfolios_spec.rb` covers it (AC-20).

**Step by step.**
1. With no AI level, the button reads **"Add rating"**, not "Override rating"
   ([:73](../web/src/components/portfolio/OverridePanel.tsx:73)), and the panel's title says the same (:83).
2. **No level is preselected** ([:23](../web/src/components/portfolio/OverridePanel.tsx:23)): with nothing underneath,
   the assessor has to choose one.
3. **The note becomes required** ([:32-33](../web/src/components/portfolio/OverridePanel.tsx:32)).
   - The label reads "Where this rating comes from (required):" (:93), with an example placeholder ("Probed in the
     second interview: …").
   - **Save stays disabled** until a level is picked and the note has text.
4. Saving posts the level and the note. If the API refuses anyway (for instance, an empty note sent by another
   client), the panel stays open and shows "Failed to save rating. Please try again." (:109).
5. Once saved, the card shows "Not assessed → L3, Rated by you ✓" (:59-65), so it's clear the level came from a person,
   not the AI. Fit/gap marks it with ✏ ("rated by an assessor").

Changing a level the AI **did** give is still an "override", and its note stays optional. That's a known P3 finding,
pinned by an `it.fails` test, and a decision for product: a required reason for every change is in the report's
human-review work.

**Tests.** [`portfolio-components.test.tsx`](../web/src/components/portfolio/portfolio-components.test.tsx):
- "offers to add a rating, with no level chosen until the assessor picks one" (:112);
- "saves the level the assessor picked" (:124), checking the exact request body;
- "AC-20: asks where the rating comes from before saving it" (:156);
- "shows the assessor's rating next to 'Not assessed' once rated" (:170);
- the known defect "asks for a reason before saving an override" (:243, `it.fails`).

## 3. Error states with Retry, long text, and 375px

**Before.**
- **P2-1:** a failed portfolio load left a blank page.
- **The fit/gap page spun forever** if the report never arrived, and re-triggered generation on every poll (P1-6).
- Long quotes stretched the cards.
- At phone width, the header and the comparison table ran off the screen.

**Where.** [`PortfolioPage.tsx`](../web/src/pages/portfolio/PortfolioPage.tsx),
[`FitGapReportPage.tsx`](../web/src/pages/fitgap/FitGapReportPage.tsx),
[`ExpandableText.tsx`](../web/src/components/portfolio/ExpandableText.tsx),
[`ComparisonTable.tsx`](../web/src/components/fitgap/ComparisonTable.tsx),
[`AssessorLayout.tsx`](../web/src/components/layout/AssessorLayout.tsx).

**Error and retry, step by step.**
1. **Portfolio load fails** (network error or 5xx): `load`
   ([PortfolioPage.tsx:75](../web/src/pages/portfolio/PortfolioPage.tsx:75)) catches it, and the page shows "Couldn't
   load the portfolio." with **Try again** (:210), which runs `load` again.
   - The session and the vacancy list only add context, so if they fail the page still loads.
2. **Generation failed**: the page shows the API's safe message for the failure category, never the raw error
   (AC-21), with **Retry** (:236), which asks the API to regenerate.
3. **Fit/gap is asked for once per visit**: the `triggered` ref
   ([FitGapReportPage.tsx:45](../web/src/pages/fitgap/FitGapReportPage.tsx:45)) stops polling from queueing a new
   job on every 404. The server lock from sub-PR 7 is the second line of defence.
4. **After two minutes** (`FITGAP_TIMEOUT_MS`, :16) the spinner stops: "This is taking longer than expected." with
   **Try again**. A fetch error shows "Couldn't load the fit/gap report." All three problems share one alert block
   (:201), and `handleTryAgain` (:121) clears the trigger, so retrying asks once more.
5. Every alert has `role="alert"`, so screen readers announce it.

**Long text, step by step.**
1. Quotes and summaries go through `ExpandableText`
   ([ExpandableText.tsx](../web/src/components/portfolio/ExpandableText.tsx)).
2. Over 280 characters (:11), the text is clamped to four lines, with a **Show more** button. The button carries
   `aria-expanded`, so a screen reader knows whether the text is open.
3. A very long string with no spaces breaks (`overflow-wrap: anywhere`) instead of pushing the card wider.
4. The threshold is a character count rather than a measurement, so it behaves the same in every browser and in tests.

**375px, step by step.**
1. **Page headers stack**: the actions wrap under the title (`flex-col` → `sm:flex-row`, PortfolioPage.tsx:162,
   FitGapReportPage.tsx:164).
2. **The comparison table becomes stacked rows on a phone** ([ComparisonTable.tsx:37-40](../web/src/components/fitgap/ComparisonTable.tsx:37)).
   The header row is hidden, and each value shows its column name from `data-label` ("Required", "Candidate",
   "Result"), so a row still reads without the header.
3. **The skill card stacks**, so the rating panel never pushes it wider.
4. **The top bar collapses to icons** ([AssessorLayout.tsx](../web/src/components/layout/AssessorLayout.tsx)). The
   labels stay as `sr-only` text, so the links are still named for screen readers.

**Tests.**
- [`portfolio.test.tsx`](../web/src/test/functional/portfolio.test.tsx):
  - "offers a retry when generation failed" (:53);
  - "tells the assessor why generation failed, in the API's safe words" (:151);
  - AC-27 "offers a retry when the portfolio can't be loaded, and recovers" (:163);
  - P2-1 (:191).
- [`fit-gap.test.tsx`](../web/src/test/functional/fit-gap.test.tsx):
  - AC-26 "stops waiting after two minutes and offers a retry" (:76);
  - AC-26 "shows an error with a retry when the report can't be fetched" (:89);
  - P1-6 "asks the API to generate the report only once while it waits" (:118).
- [`ExpandableText.test.tsx`](../web/src/components/portfolio/ExpandableText.test.tsx):
  - short text has no toggle (:10);
  - long text collapses behind Show more, with `aria-expanded` (:17);
  - an unbroken string breaks (:31).
- [`ComparisonTable.test.tsx`](../web/src/components/fitgap/ComparisonTable.test.tsx): AC-29 "labels each value, so
  the rows still read when stacked on a phone" (:73).
- **375px itself is checked in screenshots, not in a test:**
  [`mobile-portfolio.png`](report/screenshots/mobile-portfolio.png),
  [`mobile-fitgap.png`](report/screenshots/mobile-fitgap.png),
  [`long-text.png`](report/screenshots/long-text.png).
  - jsdom has no layout, so a unit test can't see horizontal scrolling. That's why the brief's screenshots carry it.

**Limits.**
- **Phone width:** no browser test runs at 375px yet; a Playwright run would make the screenshots repeatable (gap 3
  in [testing.md](testing.md)).
- **Keyboard and screen reader (AC-30):** checked by hand. "Not assessed" is text, not colour alone; Show more and Add
  rating are buttons reachable with Tab.
- **Exports:** they have no error state yet; the button simply stops spinning.
