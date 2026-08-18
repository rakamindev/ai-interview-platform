# Seeded fault test

Proof that the suites fail when the behaviour regresses, rather than merely
passing against the code as written.

Two faults were reintroduced on a scratch branch, the suites were run, and the
output was captured before reverting. Both the fault and its revert are in the
history:

```
spike/seeded-fault
  075e96e  spike: seed two faults to prove the suites catch them
  49f1636  Revert "spike: seed two faults to prove the suites catch them"
```

Reproduce with `git show 075e96e`.

## Fault 1 — the L1 coercion

`Portfolios::Generator#coerce_level` restored to the original one-liner:

```ruby
def coerce_level(value)
  value.to_i.clamp(1, 5)
end
```

`seeded-fault-1-rspec.txt` — **22 examples, 7 failures**:

| Model output | Expected | Got |
|---|---|---|
| `nil` | `nil` | `1` |
| `""` | `nil` | `1` |
| `"three"` | `nil` | `1` |
| `0` | `nil` | `1` |
| `9` | `nil` | `5` |
| `"L4"` | `4` | `1` |
| confidence when unrated | `"low"` | `"high"` |

Every one of these is a real candidate outcome: a skill the interview never
reached is recorded as L1 — *"executes with explicit guidance, cannot apply
independently"* — and a legitimate `"L4"` collapses to L1 as well.

## Fault 2 — the client/server field name

`ComparisonTable` reads `required_level` again, the name the client shipped
with and the API has never emitted:

```tsx
const required = levelLabel((c as any).required_level);
```

`seeded-fault-2-vitest.txt` — **3 failed | 15 passed**:

- `the Required column > renders the level the role requires` — cell empty
- `the Required column > renders it for every row, including unassessed ones` — cell empty
- `skills that were not assessed > shows a dash rather than a level` —
  `Found multiple elements with the text: —`

The third failure is the original defect's signature. With the fault present
the Required cell also falls back to an em dash, so an unassessed row renders
two of them. That is precisely what the screenshot of the unfixed application
shows, and it is why `tsc` could not catch this: the data crosses an
unvalidated `axios` boundary, so the declared type was never checked against
what the server actually sends.

## After revert

```
54 examples, 0 failures     # RSpec
Tests  18 passed (18)       # Vitest
```
