# UI Redesign: Rakamin Editorial Assessment Review

## Status

Approved direction: Rakamin editorial teal.

This redesign preserves the existing Rakamin color tokens. It does not replace the current palette or alter API behavior.

## Constraints

- Preserve the current primary teal (`#01959f`, `hsl(184 99% 31%)`).
- Preserve the current secondary yellow (`#FBC037`, `hsl(43 96% 60%)`).
- Preserve the existing foreground, muted, border, input, and ring tokens unless a small neutral surface tint is required for hierarchy.
- Do not change portfolio, fit/gap, vacancy-selection, polling, queue-guard, override, or export contracts.
- Do not introduce a second UI primitive convention. Reuse the existing Radix/shadcn-style components.
- No page-level horizontal overflow at 375px.

## Visual language

- Light editorial canvas with deep ink typography.
- Rakamin teal is reserved for primary actions, active navigation, links, and positive fit states.
- Rakamin yellow is reserved for attention/gap states and selected secondary emphasis.
- Use derived opacity/tint surfaces only; never replace the base palette.
- Use low-contrast borders, restrained shadows, consistent 8/12/16/24/32 spacing, and 44px minimum touch targets.
- Replace emoji status marks with Lucide icons while preserving the existing semantic colors.

## Header

### Desktop

- One 64px sticky rail inside the existing max-width container.
- Brand at left: teal monogram/icon plus `Rakamin AI Interview`.
- Primary navigation in the middle: `Assessments` and `Vacancies` as compact active/inactive pills.
- Tenant context and a compact account menu at right.
- Active navigation uses a tinted teal surface and teal text, not a hard border.

### Mobile

- One non-wrapping row.
- Short brand label (`Rakamin AI`) with the same icon.
- Navigation and logout move into the existing dropdown primitive.
- Page actions remain in the page header so the global header never becomes a multi-row action bar.

## Portfolio page

Reading order:

1. Back/breadcrumb and `Candidate portfolio` heading.
2. Candidate/session identity and processing state.
3. Four compact metrics: assessed, discovered, low-confidence, and human overrides.
4. Vacancy selector and one primary report action.
5. Skill portfolio stack: one readable full-width column on desktop and mobile.
6. Evidence and competency details stay readable inside each card.

Report action behavior remains unchanged:

- No report: `Run Fit/Gap Report` is enabled only after vacancy selection.
- Existing report: action becomes `View Fit/Gap Report`.
- Override edits use the existing save behavior. A sticky action surface is shown only when there are unsaved changes.

Skill card hierarchy:

- All primary level badges use the same fixed footprint so L1–L5 remain visually consistent.
- Skill label and confidence are secondary metadata.
- `Discovered` and `Human override` are compact badges.
- Evidence and competency summary remain readable without making every card excessively tall.
- Human rating edits open in a focused modal so the card layout does not expand or overflow.

## Fit/Gap report page

Reading order:

1. Back link, vacancy title, and report timestamp.
2. `Regenerate` primary action and a compact export menu for PDF/JSON.
3. One status surface only when generation is active or failed.
4. Summary strip: matches, gaps, exceeds, and not assessed.
5. Skill comparison.
6. Culture and competency narrative.
7. Additional/discovered skills.
8. Small generated-time and override metadata footer.

State presentation:

- Success: no redundant success banner; show the report directly.
- Generating: one compact progress/status surface and disabled duplicate generation action.
- Failure: one error surface with retry; do not duplicate the same error in multiple banners.
- Existing stored comparison rows remain visible only according to the current API response; UI changes do not alter that contract.

Comparison layout:

- Desktop: table with skill, required, candidate, result, and evidence state.
- Mobile: stacked comparison cards with labels so required/candidate/result never depend on horizontal scrolling.
- Result badges use Lucide icons and existing semantic color tokens.
- Human override remains visible as a small explicit indicator.

Narratives:

- `Culture & competency fit` is a featured AI narrative panel.
- Generated/fallback/error metadata is compact and subordinate to the narrative content.
- No hardcoded replacement narrative is introduced by the UI work.

## shadcn usage

- Add `components.json` only if needed for future CLI compatibility, configured for this Vite/Tailwind v3 project.
- Do not run a destructive initializer that rewrites `index.css` or existing components.
- Reuse existing `Button`, `Card`, `Badge`, `Select`, `DropdownMenu`, `Sheet`, `Separator`, `Tooltip`, and `Skeleton` components.
- Add only missing primitives required by the approved layout, likely `Avatar` or `ScrollArea`; avoid adding a broad component dump.

## Responsive acceptance criteria

- 375px: header remains one row, no page overflow, comparison rows stack, actions remain reachable.
- 768px: portfolio cards and report sections use the available width without awkward empty columns.
- 1280px: content remains readable inside the existing max-width and does not become an oversized centered column.
- Existing API requests, polling intervals, queue de-duplication, vacancy selection, override persistence, and export flows remain unchanged.
