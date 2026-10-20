# Video script (about 4 minutes)

The brief asks the video to show **problem clarity**, **the end-to-end user flow**, and **the feature enhancements**,
and the Product Team reviews it. So it walks the product as an assessor uses it, with very little code: the
engineering depth is in the PR.

About 570 spoken words at a calm pace. Each scene gives what's on screen, then what to say. Landing anywhere between
3:45 and 4:30 is fine.

## Before recording

1. **Stack and data:**
   - `docker compose up -d`, then `docker compose exec api bin/rails e2e:seed` (the synthetic candidates "E2E Mixed"
     and others).
   - **Stop Sidekiq** (`docker compose stop sidekiq`), so no click can queue a real model call.
2. **Code version:** record on the newest branch of the stack (`chore/rails-8-upgrade`, sub-PR 16), so what's on
   screen matches what the video says.
3. **Browser tabs, signed out to start:**
   - **Tab 1:** the login page
   - **Tab 2:** the report PDF (`assessment/report/report.pdf`), at the Step 3 reproduction ("Before" and "After")
   - **Tab 3:** the fork's PR list (`mwyzer/ai-interview-platform-fs/pulls`), with green checks
4. **375px:** keep DevTools ready in device mode at 375px (Ctrl+Shift+M).
5. **The seeded fault:** have a terminal ready with `git show 27f49f3`. It's the one-line change that put the old
   `clamp(1, 5)` back; the work log's "Seeded fault" (sub-PR 3) records the 13 specs it failed.
6. **The candidate's page:** don't run a live interview. That sends audio to the model, and the seeded session
   already shows the result. Show the candidate's page up to the hardware check, then go back.

## Scenes

### 1. Opening (0:00–0:20)

**On screen:** the report's title page, with the PR #167 link.

> This is an AI interviewer: a candidate talks with it, and it turns the conversation into a level for each skill.
> In this case study I found where it was unfair, fixed it end to end, and made the rest of the product safer to
> ship. Everything is in one umbrella pull request with sixteen focused sub-PRs.

### 2. The problem (0:20–1:00)

**On screen:** Tab 2, the Step 3 reproduction: Communication and System Design stored as L1, and fit/gap reporting
"gap".

> When I used it end to end, I found its most important flaw. A skill nobody asked about was stored as L1, the lowest
> level, and the fit/gap report counted it as a gap. So a candidate whose interview ended early, or who used the
> "end anytime" option the page offers, looked weak at things they were never asked. And the assessor reading the
> report couldn't tell "measured low" from "never measured". The candidate never chose this tool, and a wrong result
> changes a real person's year. That's the one I fixed first.

### 3. The flow, end to end (1:00–2:35)

**On screen:** Tab 1, the login page. Type a wrong password.

> Here's the product as an assessor uses it. A wrong password now says so, instead of quietly reloading the page,
> and the password can be shown.

**Sign in.** The assessment list. **Press Tab** until the assessment card is focused, then **press Enter**.

> The assessment list. Each card is now a real link, so it opens with the keyboard too.

**On screen:** the invite page. Point at "Copy link".

> From here the assessor invites a candidate and sends them a link.

**Open** the candidate link in a new tab: the role title and the hardware check. Then close it.

> The candidate opens it, checks their microphone, and talks with the AI. I won't run a live interview here; this is
> one that's already finished.

**On screen:** the portfolio of "E2E Mixed".

> At the top, a summary: two of three skills weren't assessed, and the interview ended after six minutes, ended by
> the candidate. Each of those skills says "Not assessed" in words, never as a level, with the reason, and what to do
> next: probe it in the next interview.

**Click** "Add rating" on Communication. Don't save.

> If the assessor has evidence from somewhere else, they can add a rating. With nothing from the AI underneath, they
> have to say where it comes from: Save stays disabled until they do.

**Cancel.** Choose the vacancy, then **Run Fit/Gap Analysis**.

> Fit/gap now treats those skills as unknowns, not gaps: one match, two not assessed, and no gap at all.

**Click** PDF on the fit/gap page. **Switch** to 375px.

> The export works, even with overrides or unusual characters. And on a phone, the table becomes stacked rows that
> still read without the header.

### 4. What else changed (2:35–3:15)

**On screen:** the report's sub-PR table, scrolled slowly.

> The rest is work the assessor doesn't see, but needs. One company could read and change another company's
> candidates; now every route is checked. Passwords and candidate names went into the logs; not any more. Fit/gap
> could run the same paid job twice; now it runs once. Text that was too faint to read, and buttons with no name for
> a screen reader, are fixed. And production didn't even start: it now boots, refuses the free model tier, and runs
> on Rails 8.

### 5. Proof (3:15–3:45)

**On screen:** the terminal with `git show 27f49f3`, then Tab 3, the PR list with green checks.

> To prove the tests guard the fix, I put the original bug back on a scratch branch. Thirteen tests failed, each on
> its assertion, and the revert is in the history. CI now runs both test suites, the screens in a real browser at
> desktop and phone width with an accessibility check on every page, and security scans. One AI moment worth naming:
> my first phone-width check couldn't fail. I caught it by planting a too-wide table first, then fixed the check.

### 6. What's open, and closing (3:45–4:05)

**On screen:** the report's "What I'd escalate" table.

> What's left needs a decision from someone else, so each one is written down with my recommendation: linking every
> user to their company, and a consent step before the microphone opens, under Indonesia's personal data law.
> Thanks for watching.

## After recording

- Upload as **unlisted** (YouTube unlisted, Loom, or Drive with link sharing).
- Send me the link. I'll put it in the report and in PR #167, remove the blue review marker and the DRAFT banner, and
  rebuild the PDF.

**Done 2026-10-20:** uploaded to [Google Drive](https://drive.google.com/file/d/16tFmF__U1cvyYbDWRMrgp91GKFdZaVOL/view?usp=drive_link)
(opens with the link, no sign-in); linked from the report and PR #167; the review markers and the DRAFT banner are
gone; the PDF is rebuilt.
