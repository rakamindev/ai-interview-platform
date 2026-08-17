---
version: "1.0"
name: Rakamin AI Interview
description: >-
  Design system for the Rakamin AI Interview web app (web/). Token-based,
  shadcn/ui-style, Tailwind CSS 3. Light and dark modes via class. This file is
  the source of truth for design decisions — update it together with
  web/src/index.css and web/tailwind.config.js when the planned style revamp lands.
colors:
  primary:
    value: "#01959F"
    description: Rakamin teal. Brand color; primary actions, active states, AI voice.
  primary-foreground:
    value: "#FAFAFA"
    description: Text/icon on primary surfaces.
  secondary:
    value: "#FBC037"
    description: Rakamin yellow. Secondary actions, candidate voice, highlights.
  secondary-foreground:
    value: "#5E3C22"
    description: Dark warm brown; text on secondary surfaces.
  background:
    value: "#FFFFFF"
    dark: "#0F172A"
    description: App background (light: white, dark: slate-900).
  foreground:
    value: "#0F172A"
    dark: "#F8FAFC"
    description: Default text color.
  card:
    value: "#FFFFFF"
    dark: "#0F172A"
    description: Card/surface background.
  card-foreground:
    value: "#0F172A"
    dark: "#F8FAFC"
  popover:
    value: "#FFFFFF"
    dark: "#0F172A"
    description: Floating surfaces (dropdowns, menus).
  popover-foreground:
    value: "#0F172A"
    dark: "#F8FAFC"
  muted:
    value: "#F1F5F9"
    dark: "#1E293B"
    description: Tonal backgrounds, hover fills, secondary surfaces.
  muted-foreground:
    value: "#64748B"
    dark: "#94A3B8"
    description: Secondary text, placeholders, captions.
  accent:
    value: "#F1F5F9"
    dark: "#1E293B"
    description: Hover/focus backgrounds for ghost items, nav links.
  accent-foreground:
    value: "#0F172A"
    dark: "#F8FAFC"
  destructive:
    value: "#EF4444"
    dark: "#7F1D1D"
    description: Errors, destructive actions, failure states.
  destructive-foreground:
    value: "#FAFAFA"
  border:
    value: "#E2E8F0"
    dark: "#1E293B"
    description: Default borders, dividers, input borders.
  input:
    value: "#E2E8F0"
    dark: "#1E293B"
    description: Form control borders.
  ring:
    value: "#01959F"
    description: Focus ring color (always the teal).
typography:
  family:
    value: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
    description: System font stack; no webfont is loaded.
  headline-lg:
    value: { fontSize: "24px", lineHeight: "32px", fontWeight: 600 }
    usage: Page titles (text-2xl font-semibold). Rare — one per page at most.
  headline-md:
    value: { fontSize: "18px", lineHeight: "28px", fontWeight: 600 }
    usage: Section and card titles (text-lg font-semibold).
  body-md:
    value: { fontSize: "14px", lineHeight: "20px", fontWeight: 400 }
    usage: Default body text (text-sm). The dominant size in this app.
  body-sm:
    value: { fontSize: "12px", lineHeight: "16px", fontWeight: 400 }
    usage: Dense/secondary text (text-xs), metadata, timestamps.
  label-md:
    value: { fontSize: "14px", lineHeight: "20px", fontWeight: 500 }
    usage: Buttons, nav items, list item labels (text-sm font-medium).
  label-sm:
    value: { fontSize: "12px", lineHeight: "16px", fontWeight: 600 }
    usage: Badges, status labels, small emphasis (text-xs font-semibold).
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  base: "4px"
  scale: [4, 6, 8, 10, 12, 16, 20, 24, 32]
  description: Tailwind default scale (0.25rem base). Gap rhythm: 2 (8px) inside inline groups, 4 (16px) between related blocks, 6 (24px) between page sections.
components:
  button:
    backgroundColor: { colors.primary }
    textColor: { colors.primary-foreground }
    typography: { typography.label-md }
    rounded: { rounded.md }
    padding: "8px 16px"
    variants:
      - name: default
        description: Primary action. bg-primary, shadow, hover bg-primary/90.
      - name: secondary
        description: Yellow CTA. bg-secondary text-secondary-foreground.
      - name: outline
        description: Secondary border button. border-input, hover bg-accent.
      - name: ghost
        description: Borderless; hover bg-accent. Nav and toolbar buttons.
      - name: link
        description: Inline text link, text-primary, underline on hover.
      - name: destructive
        description: Destructive action. bg-destructive.
    sizes:
      - name: default
        value: "h-9 px-4"
      - name: sm
        value: "h-8 px-3 text-xs"
      - name: lg
        value: "h-10 px-8"
      - name: icon
        value: "h-9 w-9"
  badge:
    backgroundColor: { colors.primary }
    textColor: { colors.primary-foreground }
    typography: { typography.label-sm }
    rounded: { rounded.md }
    padding: "2px 10px"
    description: Variants default (primary), secondary (yellow), destructive, outline. Use rounded-full only for pill-style status chips.
  card:
    backgroundColor: { colors.card }
    textColor: { colors.card-foreground }
    rounded: { rounded.xl }
    border: true
    shadow: "shadow"
    padding: "24px"
    description: shadcn Card with border + subtle shadow. Header uses space-y-1.5, footer p-6 pt-0.
  input:
    backgroundColor: { colors.background }
    borderColor: { colors.input }
    rounded: { rounded.md }
    typography: { typography.body-md }
    description: Inputs, selects, textareas share border-input + rounded-md + focus ring.
  dialog:
    backgroundColor: { colors.background }
    rounded: { rounded.lg }
    shadow: "shadow-lg"
    padding: "24px"
    description: max-w-lg, centered; sm:rounded-lg on desktop.
  dropdown-menu:
    backgroundColor: { colors.popover }
    textColor: { colors.popover-foreground }
    rounded: { rounded.md }
    shadow: "shadow-md"
    description: Items rounded-sm px-2 py-1.5 text-sm, focus bg-accent.
  voice-bars:
    backgroundColor: { colors.primary }
    rounded: { rounded.full }
    description: 5 bars, w-1.5, h-10 container. AI variant bg-primary, candidate variant bg-secondary. Active animates voice-bar (4px→32px, 0.8s ease-in-out infinite); inactive h-1 opacity-30.
  nav-link:
    textColor: { colors.muted-foreground }
    rounded: { rounded.md }
    description: In the assessor header. Active = bg-primary/10 + text-primary font-medium; idle = text-muted-foreground, hover bg-muted.
---

# Rakamin AI Interview — Design System

## 1. Overview

Rakamin AI Interview is a recruitment assessment platform: assessors prepare
assessments, monitor live AI interviews, and review candidate portfolios; job
candidates go through a live voice interview. The design exists to feel
**calm, competent, and trustworthy** — the candidate experience must lower
anxiety, and the assessor experience must feel fast and predictable.

The brand language is a two-color system: **teal (`primary`) for trust and
action**, **yellow (`secondary`) for energy and highlighting**. Everything else
is neutral slate. Interfaces are flat and quiet: hierarchy comes from spacing,
typography weight, and tonal backgrounds (`muted`/`accent`), not from shadows
or color noise.

**Revamp note (planned):** a visual style revamp is planned for this app. Until
it lands, this file describes the current system and is binding. When the
revamp happens, change values here **and** in `src/index.css` /
`tailwind.config.js` atomically — never leave the two out of sync, and never
introduce ad-hoc styles that bypass these tokens.

## 2. Colors

All colors are semantic tokens defined as HSL CSS variables in
`src/index.css` and mapped to Tailwind utilities in `tailwind.config.js`.
**Never use raw hex values in components** — always the utility
(`bg-primary`, `text-muted-foreground`, `border-border`).

- **`primary`** — Rakamin teal `#01959F`. Primary buttons, active nav,
  links, the AI voice, focus rings. Use for the single main action per screen.
- **`secondary`** — Rakamin yellow `#FBC037`. The candidate voice, secondary
  CTAs, highlight accents. High-contrast yellow; never use it as body text
  background at large scale.
- **`foreground` / `background`** — default text and app background. Flip
  between light (white / slate-900) and dark (slate-900 / slate-50).
- **`muted` / `muted-foreground`** — tonal fills and secondary text. The most
  common pair after background/foreground: captions, placeholders, idle states.
- **`accent`** — hover/focus fill for ghost items and nav links (same value as
  `muted` in light mode; keep them in sync).
- **`border` / `input`** — hairlines and form controls (same value in light
  mode).
- **`destructive`** — errors and destructive actions only; never as decoration.
- **`ring`** — focus ring. Always teal in both modes.

Dark mode: same semantic roles, swapped HSL values under `.dark`. Every new
UI must read correctly in both modes — use tokens, not fixed colors.

## 3. Typography

System font stack only — no webfont is loaded. The app is text-dense;
`body-md` (14px) is the default size and `text-sm` dominates the codebase.

- `headline-lg` 24/32 semibold — page titles; at most one per page.
- `headline-md` 18/28 semibold — card and section titles.
- `body-md` 14/20 regular — default body text.
- `body-sm` 12/16 regular — metadata, timestamps, dense text.
- `label-md` 14/20 medium — buttons, nav items.
- `label-sm` 12/16 semibold — badges, status labels.

Weight ceiling is **semibold (600)** — reserve `font-bold` for nothing in
this UI; headings use semibold. Keep line-height at the Tailwind default for
the size (shown above) and do not set custom letter-spacing.

## 4. Layout

- **App shell**: `min-h-screen flex flex-col`. Sticky top header
  (`h-14`, `border-b`, `bg-white`, `z-40`) with inner container `max-w-7xl
  mx-auto px-4`; main content `max-w-5xl mx-auto w-full px-4 py-6`.
- **Detail pages**: use `PageContainer` (`max-w-3xl mx-auto space-y-6`) for
  forms and detail views; list pages use the wider `max-w-5xl` shell.
- **Vertical rhythm**: `space-y-6` between page sections, `space-y-1.5` inside
  card headers, `gap-2` between related inline controls, `gap-1` inside nav.
- **Spacing scale** is Tailwind default (0.25rem base): 4px, 6px, 8px, 10px,
  12px, 16px, 20px, 24px, 32px. Prefer 8/16/24 (2/4/6) for block rhythm.
- **Density**: the assessor UI is compact on purpose — 14px text, `h-9`
  buttons, `px-4` page padding. Do not inflate spacing to fill space.

## 5. Elevation & Depth

The UI is deliberately **flat**; hierarchy is expressed with borders and
tonal fills, not shadows. Shadow usage is limited and strict:

- `shadow` — default Card surface (subtle, defines the card).
- `shadow-sm` — default, outline, secondary, destructive Buttons.
- `shadow-md` — floating menus: dropdown menus, popovers, selects.
- `shadow-lg` — Dialogs (modal surfaces).
- No shadow on nav, lists, inputs, or page sections.

Do not invent intermediate shadow levels. If something needs to pop, use
`bg-card` + `border` on a `muted` background instead of a bigger shadow.

## 6. Shapes

Radius tokens (from `--radius: 0.5rem`):

- `sm` 4px — small inner elements (menu items, dialog close buttons).
- `md` 6px — buttons, inputs, nav links, badges, dropdowns.
- `lg` 8px — dialogs on desktop (`sm:rounded-lg`).
- `xl` 12px — Cards only.
- `full` — pills: avatars, status chips, voice bars, the tenant pill.

Respect the mapping — `rounded-md` on controls, `rounded-xl` on cards,
`rounded-full` only for pill-shaped elements. Keep all corners of a surface
on the same token.

## 7. Components

Primitives live in `src/components/ui` (shadcn-style: Radix + `cva`). Reuse
them; do not re-implement in pages.

- **Button** — variants: `default` (primary CTA), `secondary` (yellow),
  `outline`, `ghost` (nav/toolbar), `link`, `destructive`. Sizes: `default`
  h-9, `sm` h-8, `lg` h-10, `icon` h-9 w-9. All `rounded-md`, `text-sm
  font-medium`, icons `h-4 w-4` with `gap-2`.
- **Badge** — `rounded-md`, `text-xs font-semibold`, `px-2.5 py-0.5`;
  variants default/secondary/destructive/outline. For status pills use
  `rounded-full` + appropriate semantic color.
- **Card** — `rounded-xl border shadow`, header `p-6 space-y-1.5`, footer
  `p-6 pt-0`. The standard surface for lists, forms, and detail blocks.
- **Input / Textarea / Select** — `border-input rounded-md`, focus ring
  `ring-ring` (teal). One consistent form control look everywhere.
- **Dialog** — `max-w-lg`, `p-6`, `shadow-lg`, `sm:rounded-lg`.
- **Dropdown menu** — `bg-popover rounded-md shadow-md`; items `rounded-sm
  px-2 py-1.5 text-sm`, hover/focus `bg-accent`.
- **VoiceBars** — the interview "speaking" indicator: 5 bars `w-1.5
  rounded-full` in a `h-10` row; AI variant `bg-primary`, candidate variant
  `bg-secondary`; active bars animate `voice-bar` (4px→32px, 0.8s ease-in-out
  infinite, staggered delay), idle bars `h-1 opacity-30`.
- **Nav link (assessor header)** — `rounded-md text-sm`; active
  `bg-primary/10 text-primary font-medium`, idle `text-muted-foreground`,
  hover `bg-muted text-foreground`. Icons from lucide-react `h-4 w-4`.
- **StatusIndicator / ConnectionStatus / InterviewTimer** — status colors map
  to semantic tokens only: ok = `primary`/`foreground`, warn = `secondary`,
  error = `destructive`.

## 8. Do's and Don'ts

### Do

- Do use Tailwind utilities with semantic tokens (`bg-primary`,
  `text-muted-foreground`, `border-border`). The only hex values in the repo
  belong in `src/index.css` token definitions.
- Do support dark mode: build with tokens that flip (background, foreground,
  muted, border, card), and check `.dark` before shipping a screen.
- Do reuse `src/components/ui` primitives and lucide-react icons (default
  `h-4 w-4`) — never hand-roll a button, badge, or dialog in a page.
- Do use `text-sm` as the default body size and `font-semibold` as the
  heading weight ceiling.
- Do express hierarchy with spacing, weight, and tonal fills (`muted`,
  `bg-primary/10`) before reaching for shadows.
- Do keep one primary action per screen — `bg-primary`; everything else
  secondary/ghost/outline.

### Don't

- Don't introduce new colors, hex values, font stacks, radius tokens, or
  shadow levels without updating this file, `src/index.css`, and
  `tailwind.config.js` together.
- Don't use `destructive` for decoration, `secondary` for large text
  backgrounds, or `primary` for non-interactive decoration.
- Don't use `rounded-full` on buttons/cards/inputs (reserved for pills and
  avatars) or `rounded-xl` on anything that is not a Card.
- Don't use `shadow-lg`/`shadow-md` on cards or page sections — cards use
  `shadow`, menus `shadow-md`, dialogs `shadow-lg`.
- Don't use `font-bold`; don't set custom letter-spacing or line-heights.
- Don't ship one-off CSS files or inline `style={{...}}` for layout or color;
  utilities and tokens only.
- Don't make the candidate interview screen look like the admin UI — it may
  share tokens, but it must feel calmer and more spacious, never busy.
