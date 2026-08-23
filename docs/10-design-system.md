# 10 — Design System

**Provenance: `[SPEC]`.**

---

## 1. Design Thesis

> **The evidence is the hero. The level is a lookup key.**

The current portfolio card puts the level badge first: largest, leftmost, strongest colour. That hierarchy *is* the bug, visually. The design system inverts it.

---

## 2. The Anchor Rail

A fit/gap comparison is not two numbers in two columns. It is two positions on one ruler — the L1-L5 anchors the assessment was built from.

```
React        +-------+---^---+---o---+-------+    exceeds by 1
                     req     cand

Testing      +---o---+.......................+----+    position uncertain
                 +--- evidence band ---+          asked once
```

At high confidence the candidate mark is a precise dot; as confidence falls it widens into a soft band. **Uncertainty becomes a shape, not a badge** — so a reader cannot mistake "we did not ask enough" for "this person is weak", and the distinction survives greyscale and colour blindness.

### Implementation

`web/src/components/fitgap/AnchorRail.tsx:1-140`:

- Confidence `high`: 12px dot, full opacity
- Confidence `medium`: 16px dot, 75% opacity, 2rem uncertainty band
- Confidence `low`: 24px dot, 50% opacity, 3.5rem uncertainty band
- Requirement mark: triangle (always visible)
- Candidate mark: colored dot (match=green, gap=red, exceed=blue)
- L1-L5 tick labels below the rail
- ARIA label for screen readers (`AnchorRail.tsx:38-59`)

---

## 3. Verdict Tokens

Not encoded red-to-green. Partly accessibility, mainly this: red means "reject this person". A gap is information, not a moral verdict on a human being.

### Token System

```typescript
FIT_GAP_RESULT_LABELS = {
  match: "Match",
  gap: "Gap",
  exceed: "Exceeds",
  insufficient_evidence: "Insufficient evidence",
  not_assessed: "Not assessed"
}

FIT_GAP_RESULT_CLASSES = {
  match: "bg-verdict-match/10 text-verdict-match",
  gap: "bg-verdict-gap/10 text-verdict-gap",
  exceed: "bg-verdict-exceed/10 text-verdict-exceed",
  insufficient_evidence: "bg-verdict-unknown/10 text-verdict-unknown",
  not_assessed: "bg-muted text-muted-foreground"
}
```

### Color Tokens

| Token | Usage | Color |
|-------|-------|-------|
| `verdict-match` | Skill matches requirement | Green |
| `verdict-gap` | Skill below requirement | Amber/Orange |
| `verdict-exceed` | Skill above requirement | Blue |
| `verdict-unknown` | Insufficient evidence | Gray |

---

## 4. Dark Mode

`web/src/components/ThemeToggle.tsx` — toggle between light and dark themes.

All verdict tokens are defined with CSS custom properties that adapt to the current theme. The anchor rail uses `bg-rail-track`, `bg-mark-requirement` which change in dark mode.

---

## 5. Colourblind-Safe Design

The anchor rail is designed to work without relying solely on colour:

- **Shape** distinguishes requirement (triangle) from candidate (dot/circle)
- **Position** on the rail conveys level relationship
- **Uncertainty band width** conveys confidence
- **Opacity** varies with confidence level
- **ARIA labels** provide text alternatives

The verdict tokens use distinct hues (green, amber, blue, gray) that are distinguishable in most forms of colour blindness.

---

## 6. No Radar Chart

A radar plot implies the axes are commensurable and the enclosed area means something. Neither is true. A reader would read the shape as a summary judgement — exactly the false confidence being removed.

---

## 7. Override Provenance

`web/src/components/fitgap/OverrideProvenance.tsx` — when a skill has been overridden, the comparison table shows a small indicator linking to:

- Who made the override (`overridden_by`)
- When (`overridden_at`)
- Why (`assessor_notes`)

This is the human-in-the-loop made visible.

---

## 8. Confidence Indicator

`web/src/components/portfolio/ConfidenceIndicator.tsx` — renders confidence as a colored dot:

- `high`: green dot
- `medium`: amber dot
- `low`: red dot
- Absent: no dot rendered (not "low")

---

## 9. Skill Portfolio Card

`web/src/components/portfolio/SkillPortfolioCard.tsx` — displays a single skill with:

- Skill label
- Level badge (L1-L5)
- Confidence indicator
- Evidence quotes (expandable)
- Competency summary
- Override indicator (if present)
- AI presence status (`current` / `stale`)

---

## 10. Layout System

Two layouts:

- **AssessorLayout** (`web/src/components/layout/AssessorLayout.tsx`) — sidebar navigation for assessors
- **CandidateLayout** (`web/src/components/layout/CandidateLayout.tsx`) — minimal layout for candidates during interview

---

## 11. Component Library

Based on shadcn/ui primitives:

```
ui/
  accordion.tsx, alert-dialog.tsx, badge.tsx, button.tsx,
  card.tsx, dialog.tsx, dropdown-menu.tsx, input.tsx,
  label.tsx, password-input.tsx, progress.tsx, radio-group.tsx,
  select.tsx, separator.tsx, skeleton.tsx, sonner.tsx,
  tabs.tsx, textarea.tsx, tooltip.tsx
```

All styled with Tailwind CSS. Theme defined in `web/src/index.css`.
