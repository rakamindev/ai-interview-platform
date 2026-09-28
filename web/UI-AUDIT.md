# UI refinement audit — 23 September 2026

Primary reference: [`DESIGN.md`](DESIGN.md), the original Cal.com design reference moved from the repository root into `web/` at the user's request. It replaces the earlier adaptation notes. The implementation uses near-black actions, 40px controls, 8px control radii, and 12px container radii, adapted to the recruitment workflow.

## Gaps and changes

| Area | Gap found | Incremental refinement |
| --- | --- | --- |
| Filters | Native selects differed from form selects | Reusable `FilterSelect` using the installed Radix primitives; original values, callbacks, filter scope, sorting, and pagination preserved |
| Select overlays | Inconsistent selection feedback and unbounded positioning | Trigger minimum width, viewport bounds, collision padding, scroll controls, visible checked/highlighted states, stable chevrons, and 150ms transitions |
| Inputs and search | Strong offset focus rings; browser-specific clear control | Quiet focus treatment, error and disabled surfaces, explicit accessible search-clear action that restores input focus |
| Dialogs | Edge-to-edge mobile width, no height constraint, heavy backdrop | Mobile gutters, viewport height limit, internal scrolling, quieter backdrop, larger close target, and disabled close during invitation submission |
| Menus and tooltips | Overlay bounds and tooltip clipping risk | Collision padding, viewport constraints, menu scrolling, portalled tooltip, and explicit transition timing |
| Tabs and radio controls | Inconsistent radii, focus, and selected treatment | Neutral selection, consistent control radius, restrained focus and hover states, wrapped tabs, no tab shadow |
| Skill picker | Fetch failure appeared as no results | Separate loading/error/empty states, retry preserving query, accessible search name and dialog description, stale request protection |
| Content | Tight card headings, duplicate form separator, tiny skill icon targets | Readable heading line height, single action separator, 32px drag/remove targets, and specific remove-button names |

Page titles use 24–28px semibold type, with 14px body text and the reference's system font fallback when Inter is unavailable. Flat cards, the 224px sidebar, horizontal mobile navigation, form/report widths, table scanning structure, and semantic status distinctions remain intact. No new application UI library was added. Backend services and hiring rules were not changed.

## Follow-up UX corrections

- Assessment requirements moved above the candidate list into a collapsible section.
- Pagination now reads, for example, “Showing 1–10 of 14 candidates.”
- Breadcrumbs use names already loaded by each page, plus its current activity, with IDs only as fallback. No additional data requests are introduced.
- Vacancy and assessment edit pages use the saved record title and clearer section descriptions. Fixed an assessment edit load-error branch that was incorrectly nested inside its loading branch.
- Radix background scroll locking remains intact. Stable document gutters prevent layout movement; long option lists expose a thin scrollbar and retain scroll buttons.
- Overrides now use a dialog with original AI rating, recruiter rating, and notes. Failed saves retain input, cancel discards the draft, successful saves restore trigger focus, and saving disables dismissal and edits.
- Vacancy comparison moved above portfolio skills, with a label, explanation, export-context note, and empty-vacancy action.

## Verification

### Action feedback follow-up — 24 September 2026

- Desktop and mobile logout triggers now open the existing Radix confirmation dialog. Cancel retains authentication; confirmation clears it and navigates to sign-in.
- Copy feedback no longer clears its successful label before a repeated clipboard write. Concurrent clicks are guarded; denied writes still expose the manual-copy fallback.
- A shared, dismissible live-region toast reports action outcomes across navigation: invitation creation/copy, assessment/vacancy saves, overrides, hiring decisions, exports, regeneration, ending an interview, and sign-in/logout. Repeated feedback replaces the current notice rather than stacking. Hover/focus pauses dismissal; reduced motion remains respected.
- Validation stays beside fields, load failures retain retry views, and polling/filter changes do not emit toasts. Download feedback says “download started,” not that the file was saved.
- 30 tests pass, including logout confirmation/cancel, repeated clipboard writes, toast replacement/dismissal, and hover pause. Chromium checks at 1440px and 390px verified stable copy labels, logout cancel/confirm, toast persistence across navigation, no overflow, and no JavaScript errors using mocked responses.

- Production build passed; 26 Vitest tests passed. Added interaction coverage for selection, Escape/focus restoration, disabled filters, skill taxonomy failure/retry, breadcrumb hierarchy, and override failure/retry/cancel. Updated existing filter tests to operate the Radix controls.
- Chromium checks at 1440px and 390px: assessment list, candidate invitation dialog, and assessment creation. Checked filter/reset behavior, keyboard opening/dismissal, focus restoration, popup bounds, dialog gutters, and document overflow. No JavaScript errors observed.
- Follow-up Chromium checks at 1440px and 390px covered assessment requirements, resource pagination, named breadcrumbs, vacancy editing, and portfolio comparison/override. Checked 30-option scrolling, stable page width on dropdown open, unchanged evidence-card height during override editing, failed-save retry, and document overflow.
- Browser-only component fixture: keyboard option selection, long option wrapping, disabled option/trigger/input/button states, invalid input treatment, search clear/focus, menu dismissal, tab arrow navigation, tooltip display, and reduced-motion animation suppression.
- Reviewed desktop/mobile screenshots and component states. Default, hover, focus, open/active, selected, disabled, and error treatments were checked where applicable; loading and retry were exercised for the skill picker.
- Browser API responses were mocked. The component fixture and runner stayed outside the application source; no sample records were inserted. Live audio, real backend mutations, and AI generation were not exercised end to end in this pass.

The broader report-page checks recorded in the former adaptation notes predate this pass; this pass concentrated browser verification on the changed shared controls and their recruitment flows.
