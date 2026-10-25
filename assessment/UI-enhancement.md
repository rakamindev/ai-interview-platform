# UI Enhancement — Mobile Responsive (All Pages) + RHF Consistency + Empty/Loading States + Password Policy

> **Finding:** UI enhancement (non-F, voluntary product improvement) · **Classification:** Missing Specification · **Area:** Fullstack — Frontend (`web/`) responsive layout, forms & states + Backend (`api/`) password policy · **UU PDP:** Partial (password hardening aligns with personal-data security posture)
> **Branch:** `feat/ui-enhancement` · **Status:** ✅ Completed & verified

---

## 1. Summary

The assessment brief (Step 6) requires polished, mobile-friendly UI — the Product Team scores 50% on UI/UX taste, documentation and demo (screenshots + 3-5 min video), and Disqualifier #6 automatically rejects submissions with poor/unmaintained UI. Before this work the app was only "passively responsive": a single-column stack with almost no breakpoints (`grep` showed only 2 files using `sm:/md:/lg:`), the assessor navbar overflowed at 320–375px, every header with title + action buttons squeezed on narrow screens, two forms still used manual `useState` instead of the react-hook-form pattern used everywhere else, one report page rendered a bare table with no empty state, and passwords had no length policy at all on either side of the stack.

User impact if left unfixed: assessors on phones or small laptops would see a clipped navbar, colliding action buttons and overflowing forms; the candidate interview page would break on mobile; inconsistent form behavior made validation feedback unpredictable; and a one-character password was accepted as valid — a weak baseline for a platform that processes personal interview data (UU PDP context).

## 2. Analysis & Gap to Ideal

Root cause: the UI was built desktop-first without a shared responsive vocabulary. Layouts relied on `flex items-center justify-between` rows that assume wide screens, fixed-width selects (`w-40`/`w-56`), and inline action stacks with no wrapping. Forms evolved incrementally — most migrated to react-hook-form during earlier findings, but Login and the Invite dialog were left behind. Empty/loading states were added per-page during F-26 with no pass over edge cases like a zero-match fit/gap report. The `User` model trusted `has_secure_password` alone, which only enforces a 72-byte maximum implicitly — no minimum length.

Code-level evidence:

| File | Evidence |
|------|----------|
| `web/src/components/layout/AssessorLayout.tsx` | Navbar renders brand + 2 nav links + tenant badge + logout in one `h-14` row — overflows at 320–375px |
| `web/src/pages/*` (assessment/vacancy/portfolio/fitgap/transcript/monitor) | Headers use `flex items-start justify-between` / `flex items-center justify-between`; action groups `flex gap-2` with no wrap |
| `web/src/pages/assessments/AssessmentNewPage.tsx` / `AssessmentEditPage.tsx` | Selects fixed at `w-40`; skill action buttons side-by-side; `flex justify-end` form actions |
| `web/src/pages/auth/LoginPage.tsx` | Manual `useState` email/password + native HTML `required` only — only form not on react-hook-form (Signup, assessment & vacancy forms already are) |
| `web/src/pages/assessments/AssessmentInvitePage.tsx` | Dialog name input driven by `useState`, no validation; session rows `flex justify-between` |
| `web/src/components/fitgap/ComparisonTable.tsx` | Renders header + empty `<tbody>` when `comparisons` is empty — no explanation |
| `api/app/models/user.rb` | `has_secure_password` only — no password length validation (implicit bcrypt max 72 only, no minimum) |

Gap to ideal condition:

- All pages free of horizontal scroll / clipped content at 320–375px; headers and buttons wrap; form fields full-width; single breakpoint story (content flips together with the navbar at 768px).
- Every form uses the same react-hook-form pattern (`onTouched`, `role="alert"` field errors, API errors as form-level Alert).
- Every data page has skeleton / empty / error states; no page renders a void with no explanation.
- Password policy enforced as a two-sided contract: backend model + spec + mirrored frontend rules with identical messages.

## 3. Options & Trade-offs

### Option A — Systematic per-page audit-pass, drawer navbar, RHF for the remaining forms, two-sided password policy ✅ **CHOSEN**

Four pillars executed in one enhancement branch: (1) responsive pass over every page (Tier 1: assessment & vacancy + child routes first, then portfolio/fitgap/transcript/monitor, then auth/interview) with breakpoints unified on `md:`; (2) the remaining two forms converted to react-hook-form; (3) empty/loading state gaps filled; (4) password length 8–72 as a backend + frontend contract.

| Aspect | Assessment |
|--------|------------|
| **Product Impact vs Cost** | All pages usable at 320–1280px, consistent form UX, credible security baseline — high value at moderate cost (class-level layout edits + 2 form refactors + 1 validation + tests) |
| **Long-term Maintainability** | Excellent — one breakpoint story (768px, same as the navbar drawer), one form pattern app-wide, one password rule mirrored explicitly in both layers |
| **Failure Modes** | Low — changes are class-level (no state/structure rewrites); desktop verified at 1280px per page; password validation is `allow_nil` so existing users are never locked out; seeded faults prove both test suites catch regressions |
| **Contextual Fit** | Follows the reviewer's explicit direction ("all pages, especially assessment & vacancy plus child routes"); password policy only added as a full two-sided contract, never frontend-only |

### Option B — Full mobile-first rewrite of every page ❌ Rejected

Rewrite all 15+ pages to a mobile-first layout system. Cheaper to imagine, expensive and risky in practice: dnd-kit sortables, `useFieldArray`, and existing tests would all churn; not proportional for a polish enhancement two days before the demo deadline.

### Option C — Frontend-only password hint (no backend validation) ❌ Rejected

Min/max rules in the Signup form only. Forbidden by the team's own rule ("never frontend-only contracts") — an API client could still create weak passwords, and that half-solution would be hard to defend in the technical interview.

### Trade-offs accepted (for the chosen option)

| Trade-off | Justification |
|-----------|---------------|
| Width between 640–767px keeps the mobile layout (was previously split at 640px) | Unifying on `md:` makes navbar and content flip at the same point — one rule, easy to explain; the intermediate range is rare (phone landscape/small tablets) |
| A custom `xs:` breakpoint was NOT added | No element proved to need styling below 480px after the audit; adding a breakpoint without a real need costs ongoing variant maintenance — deferred until a real case appears |
| Password policy is length-only (8–72), no complexity rules | NIST 800-63B guidance: length over complexity; avoids friction and regex-sync risk between two layers; stronger password baseline with minimal UX cost |
| `has_secure_password` already caps 72 bytes implicitly | The explicit `maxLength: 72` makes the contract visible and testable in both layers instead of relying on a bcrypt implementation detail |

## 4. Solution Implemented

Per-layer changes (11 small commits on `feat/ui-enhancement`):

| File(s) | Change |
|---------|--------|
| `web/src/components/ui/sheet.tsx` (new) | Reusable Sheet (Radix Dialog variant, side left/right/top/bottom) with overlay + slide animations + focus trap/Escape. Commit 1. |
| `web/src/components/layout/AssessorLayout.tsx`, `web/src/App.tsx`, `web/src/pages/dev/NavbarPlayground.tsx` (new), `web/src/components/layout/__tests__/AssessorLayout.test.tsx` (new) | Mobile drawer navbar: hamburger `<768px` opens a left Sheet with nav links, tenant badge (same pill style as desktop, no icon) and logout; auto-closes on navigation and Escape; desktop header pixel-identical. Dev-only playground `/dev/navbar-playground` presenting 3 candidates for the design decision; 4 new tests. Commits 1–2. |
| `AssessmentListPage/NewPage/EditPage.tsx`, `LevelRadio.tsx` | Responsive: header wrap, action stacks `flex-col-reverse md:flex-row`, selects `w-full md:w-40`, LevelRadio wrap; breakpoints on `md:`. Commit 3. |
| `AssessmentInvitePage.tsx` + test | Responsive header & session rows (name truncates, actions wrap); Invite dialog converted to react-hook-form (whitespace-only blocked with inline error, empty allowed → submits `undefined`, reset on open, stays open on API failure — NEW-F-01 preserved); 2 new tests. Commit 4. |
| `VacancyListPage/NewPage/EditPage.tsx` | Same responsive treatment; actions stack on mobile. Commit 5. |
| `web/src/pages/auth/LoginPage.tsx` + test | Converted to react-hook-form: email mirror of backend regex, `onTouched`, `role="alert"` field errors, API errors stay form-level Alert; 2 new tests. Commit 6. |
| `api/app/models/user.rb`, `api/spec/models/user_spec.rb` (new) | `validates :password, length: { in: 8..72, message: "must be between 8 and 72 characters" }, allow_nil: true` — NIST 800-63B, bcrypt 72 limit, existing users not invalidated on non-password updates; 5 new spec examples. Commit 7. |
| `web/src/pages/auth/SignupPage.tsx` + test | Mirrored rules `minLength 8` / `maxLength 72` with the exact backend message; 3 new tests. Commit 8. |
| `PortfolioPage/FitGapReportPage/TranscriptPage/LiveMonitorPage.tsx`, `SkillPortfolioCard.tsx`, `OverridePanel.tsx` | Tier 2 responsive: action stacks wrap below headers, coverage rows wrap, skill label truncates, OverridePanel renders full-width when open; breakpoints on `md:`. Commit 9. |
| `web/src/components/fitgap/ComparisonTable.tsx` | Empty state with title + explanation instead of a bare table at zero comparisons. Commit 10. |
| `web/src/pages/interview/InterviewPage.tsx` | Bottom bar (connection status + Mic / End Interview / dev button) wraps at 320px. Commit 11. |

> **AI-Human Verification:** the reviewer corrected the drawer tenant badge to match the desktop pill style with no icon; the reviewer unified a legacy label inconsistency ("Add from Skill Taxonomy" vs "Add from B7 taxonomy") manually; the reviewer surfaced the breakpoint question (small viewport baseline and the 640 vs 768px split) which led to unifying all breakpoints on `md:`; the reviewer reported the OverridePanel layout on small screens, fixed by rendering it full-width.

## 5. Acceptance Criteria & Edge Cases

| # | Criterion | Input | Expected Behavior | Edge Case |
|---|-----------|-------|-------------------|-----------|
| 1 | All Tier 1 pages have no overflow at 320px/375px | Viewport 320 & 375px, every assessment/vacancy route | No horizontal scroll; headers/buttons wrap; form fields full-width | 320px (iPhone SE) stays clean |
| 2 | Desktop unchanged | Viewport ≥1024px | Layout identical to before the enhancement (regression check per page) | — |
| 3 | Mobile navbar usable with a11y | 375px, assessor logged in | All actions reachable; drawer auto-closes on navigation and Escape; aria labels present | Route change closes the drawer |
| 4 | Tier 2 & 3 pages clean | 320/375/768/1280px | No clipped content; fit/gap table remains horizontally scrollable | — |
| 5 | Login uses RHF | Empty submit / invalid email | Field errors `text-xs text-destructive` + `role="alert"`, cleared live; API error stays form-level Alert | onTouched fires on blur |
| 6 | Invite dialog uses RHF | Whitespace-only name / empty / API failure | Whitespace-only blocked with inline error and dialog stays open; empty allowed (optional); failure keeps dialog open with Alert (NEW-F-01) | Creating state disables inputs |
| 7 | Empty/loading complete & consistent | Every data page | Skeleton while loading, clear message when empty, Alert on error | Zero-match fit/gap shows an explanatory empty state |
| 8 | No regressions | Full test suites | `tsc --noEmit` 0 errors; Vitest green (Login/Invite/Signup tests updated); RSpec green | — |
| 9 | No unnecessary new dependencies | package.json diff | No zod expansion, no TanStack Query, no new runtime dependency | — |
| 10 | Password policy backend | Signup with password <8 or >72 chars | 422 with the F-26 envelope; 8–72 accepted | `allow_nil` keeps existing users valid on non-password updates |
| 11 | Password policy frontend mirror | Typing a short password in Signup | Live field error (onTouched) with the exact backend message | Existing weak-password users can still log in — policy applies to new passwords only |
| 12 | User model spec covers the contract | `api/spec/models/user_spec.rb` | Valid/invalid cases + exact message assertion + allow_nil case; seeded fault proven | — |

## 6. Tests & Verification

Automated:

- Backend: `api/spec/models/user_spec.rb` (5 examples: 8/72 valid, <8/>72 invalid with exact message, allow_nil) — full suite **87 examples, 0 failures** (was 82). Seeded fault: removing the validation fails 2 examples → reverted.
- Frontend: `tsc --noEmit` 0 errors; Vitest **61 tests green** across 11 files (was 50): +4 AssessorLayout (drawer open, auto-close navigation, Escape, desktop nav), +2 Login (empty-submit block, email format), +2 Invite dialog (whitespace-only block, empty-optional), +3 Signup (password <8, >72, live-blur). Seeded fault: removing the Signup rules fails 3 test cases → reverted.
- No new dependencies added (zod/TanStack Query untouched).

Manual (reviewer-verified):

- Navbar drawer: open/close via hamburger, overlay, Escape; auto-close on navigation; desktop ≥768px identical.
- Responsive checklist at 320/375/768/1280px across Tier 1–3 pages; no horizontal scroll, buttons wrap, forms full-width.
- RHF: Login empty/invalid email field errors without sending a request; Invite dialog whitespace-only blocked with dialog staying open; empty name submits successfully.
- Password policy: short password shows the exact mirrored message live; 8–72 accepted; login with a legacy account still works.
- OverridePanel on the portfolio page renders full-width when opened on a small viewport.

Artifacts (screenshots, referenced in the PR): `.ai-audit/ui-screenshots/01-navbar-playground-mobile-375px.png` (navbar candidates), `02-navbar-drawer-production.png` (drawer in the real app), `03-assessment-new-form-desktop.png` (desktop regression). Additional mobile screenshots of each page captured during the reviewer's manual pass are appended before the PR link (see the assessment checklist in the submission doc).

## 7. AI-Human Verification

1. **Tenant badge correction.** The first drawer version rendered the tenant badge with an icon; the reviewer asked for the same pill style as the desktop header without an icon. Fix applied before wider verification. Lesson: reuse the existing visual language verbatim when extending a UI into a new surface.
2. **Legacy label inconsistency.** The reviewer spotted "Add from Skill Taxonomy" (create) vs "Add from B7 taxonomy" (edit) for the same picker and fixed the typo manually. Lesson: always grep for the same feature's naming across pages before writing new labels.
3. **Breakpoint baseline questions.** The reviewer asked where the 375px baseline comes from and challenged the 640px (`sm:`) flip point as "too large". Discussion led to unifying every content breakpoint on `md:` (768px) so pages flip together with the navbar drawer; a custom `xs:` breakpoint was deliberately deferred until a real sub-480px need appears. Lesson: a consistent single breakpoint story is easier to explain than a bespoke one.
4. **OverridePanel layout on small screens.** The reviewer reported the override control looked off at small sizes; the panel now renders full-width below the skill header (also roomier on desktop). Lesson: interactive panels that expand in place must leave the row layout, not stay squeezed next to the header.

---

*UI enhancement completed: 87 RSpec passing (5 new, seeded fault proven), 61 Vitest green (11 new, seeded fault proven), tsc 0 errors, 11 small commits on `feat/ui-enhancement`.*