# 11 — AI Verification Log

**Provenance: `[CODE]`.**

Five entries of where AI code generation was wrong or risky.

---

## Entry 1: The VITE_DEV_TOKEN P0 Claim That Was Wrong

### The Claim

Reading `authAtom.ts:10`:

```typescript
return localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_DEV_TOKEN ?? null;
```

Vite inlines `import.meta.env.*` at build. `web/README.md:57` lists `VITE_DEV_TOKEN` as **Required**. Therefore — the reasoning went — every visitor to the deployed bundle holds a live admin JWT, and `clearToken()` cannot log anyone out. Draft severity: **P0, active, exploitable.**

### The Verification

Checking `web/.env` (key names and value lengths only, never values) showed `VITE_DEV_TOKEN` present and **empty**. That changes everything: Vite substitutes `""`, and `??` falls through only on `null`/`undefined`. `""` is neither, so the chain stops and returns `""` — falsy at both `if (token)` and `if (!token)`. **Current behaviour is correct.**

### Reclassification

Reclassified to [P1-30](03-findings-register.md#p1-30), leading with the state rather than the consequence: dormant today, armed the moment anyone follows the README.

### The Lesson

The reasoning chain was individually sound at every step and still wrong, because one link was assumed rather than checked. That is the characteristic failure of AI-assisted analysis: fluent, internally consistent, and wrong at exactly one joint.

**Every P0 was re-walked against the rule that came out of it: a severity claim about runtime behaviour requires checking runtime state, not only source.**

---

## Entry 2: Five Delegated Agents Failed with 529 Overloaded

Five delegated analysis agents were spawned to investigate different areas of the codebase. All five failed with `529 Overloaded` and returned nothing.

### What Happened

Rather than writing plausible findings from expectation, those areas were read directly. Four items that could not be verified exhaustively are labelled **suspected, not confirmed** in [03, section 8](03-findings-register.md#8--items-to-verify-during-implementation).

### The Lesson

Those are precisely the claims that would have been easiest to state confidently and hardest for a reviewer to check. The failure to verify was more honest than a plausible but unverified claim would have been.

---

## Entry 3: The nil.to_i.clamp(1,5) Bug

### The Claim

AI code generation suggested `nil.to_i.clamp(1,5)` as a safe way to handle missing levels. This is idiomatic Ruby and looks defensive.

### The Reality

`nil.to_i` returns `0`. `.clamp(1,5)` returns `1`. So a missing level is silently recorded as L1 — the lowest possible rating. This is the opposite of defensive: it converts absence of evidence into evidence of absence.

### The Fix

Replaced with nullable `ai_level` + `rating_state` enum. `nil` means "not rated", integer 1-5 means "rated". No silent conversion.

---

## Entry 4: The destroy_all Cascade

### The Claim

AI-generated portfolio regeneration code used `portfolio_skills.destroy_all` before inserting new skills. This looks clean — delete old, insert new.

### The Reality

`has_one :assessor_override, dependent: :destroy` on `PortfolioSkill` means `destroy_all` cascades through overrides, silently deleting human corrections.

### The Fix

Replaced with `upsert` + `mark_stale_and_restored`. Overrides survive regeneration. Each change is an audit event.

---

## Entry 5: The Confidence Threshold Assumption

### The Claim

AI analysis suggested that `low` confidence should still produce a hard verdict (match/gap/exceed) with an annotation. This is the "show everything, annotate later" approach.

### The Reality

The generator assigns `low` at `probe_count <= 1` (`generator.rb:100`). Asserting a gap on one probe is not defensible. The annotation would be ignored by most readers, and the verdict would be treated as definitive.

### The Fix

`low` confidence now yields `insufficient_evidence` — delta shown but not asserted. This is flagged for ratification in [TO-7](05-trade-offs.md#to-7) because it is a policy judgement, not an engineering one.

---

## Pattern

All five entries share a common structure:

1. AI suggestion was individually sound at each step
2. One link in the chain was wrong (assumed, not checked)
3. The failure was caught by reading runtime state or checking actual behaviour
4. The fix required understanding the product semantics, not just the code

**The rule that came out of it: a severity claim about runtime behaviour requires checking runtime state, not only source.**
