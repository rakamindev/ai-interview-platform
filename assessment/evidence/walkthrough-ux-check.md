# Walkthrough UX check — 2026-11-07

Agent-run on `fix/walkthrough-ux`, based on `66cce5b`. Synthetic assessment 3, session 22; fit/gap vacancy 3. Chrome responsive viewport; existing local API and Vite servers. No decision saved and no regeneration requested.

## Browser measurements

Read through Chrome DevTools Console: `JSON.stringify([innerWidth, innerHeight, document.documentElement.scrollWidth, document.documentElement.clientWidth])`.

| Page | innerWidth | innerHeight | scrollWidth | clientWidth | scrollWidth <= clientWidth |
|---|---:|---:|---:|---:|---|
| `/assessments/3/sessions/22/portfolio` | 375 | 812 | 375 | 375 | true |
| `/assessments/3/sessions/22/fitgap/3` | 375 | 812 | 375 | 375 | true |
| `/assessments/3/sessions/22/portfolio` | 1280 | 812 | 1280 | 1280 | true |
| `/assessments/3/sessions/22/fitgap/3` | 1280 | 812 | 1280 | 1280 | true |

Button horizontal boundaries, CSS pixels, rounded from `getBoundingClientRect()`:

| Viewport width | Page/control | Left | Right |
|---:|---|---:|---:|
| 375 | Portfolio: Set level | 32 | 137 |
| 375 | Portfolio: vacancy select | 16 | 359 |
| 375 | Portfolio: Open fit/gap report | 16 | 175 |
| 375 | Portfolio: Download PDF | 16 | 174 |
| 375 | Portfolio: JSON (for systems) | 186 | 323 |
| 375 | Fit/gap: Regenerate | 16 | 136 |
| 375 | Fit/gap: PDF | 144 | 222 |
| 375 | Fit/gap: JSON | 230 | 317 |
| 1280 | Portfolio: Change decision | 272 | 424 |
| 1280 | Portfolio: vacancy select | 256 | 628 |
| 1280 | Portfolio: Open fit/gap report | 256 | 415 |
| 1280 | Portfolio: Download PDF | 652 | 810 |
| 1280 | Portfolio: JSON (for systems) | 822 | 959 |
| 1280 | Fit/gap: Regenerate | 675 | 796 |
| 1280 | Fit/gap: PDF | 804 | 881 |
| 1280 | Fit/gap: JSON | 889 | 976 |

Visual inspection: 0 observed overlaps or horizontally clipped action buttons at either width; scrolled to inspect opened skill and lower action groups. Compare/share groups stack at 375 and sit side by side at 1280. Fit/gap title and actions stack at 375. The comparison table already has an `overflow-x-auto` wrapper; its columns remain unchanged.

Interaction checks: Open fit/gap disabled before selection, enabled after choosing Frontend Lead (synthetic export demo), navigated to vacancy 3. Change decision opened the level/note editor; Cancel returned to the existing decision. Set level displayed with the pencil icon for the opened Not rated skill. Flagged Keep/Change implementation unchanged.

## Gates

| Command | Result | Exit |
|---|---|---:|
| `npm test -- --run` | 3 files, 29 tests passed | 0 |
| `npx tsc --noEmit` | no errors | 0 |
| `npm run build` | 1844 modules transformed; Vite build completed | 0 |
| `bundle exec rspec` (Ruby 3.3.2) | 112 examples, 0 failures; seed 12652 | 0 |

RSpec duration: 15.93 s (load 4.54 s). Vitest duration: 2.18 s. Vite build: 6.87 s. Existing assertions unchanged.
