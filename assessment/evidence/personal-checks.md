# Farros's own checks (run by Farros in his VS Code terminal, output saved with `tee`)

| Check | When | Result (from the saved file) | File |
|---|---|---|---|
| Backend tests: `cd api && bundle exec rspec` | 7 Nov 2026, ~12:51 WIB | 112 examples, 0 failures (seed 36441) | `rspec.txt` |
| Frontend tests: `cd web && npm test -- --run` | 7 Nov 2026, 12:48:23 WIB | 3 files, 29 tests passed | `vitest.txt` |
| Earlier decisions (session 28) | 7 Nov 2026, ~13:45 WIB | Farros saw: "Event streaming (Kafka) · no longer in this report · Your decision L3 · Kept for the record. It isn't applied to any other skill." Header: 3 items need attention | pasted in chat |
| Phone width (portfolio page) | 7 Nov 2026, ~13:15 WIB | Farros: "the phone width look good" on the report; found the fit/gap header overflowing (F3, since fixed) | chat |
| Walkthrough UX issues | 7 Nov 2026, ~13:15 WIB | Farros found F1–F3 himself (decision control hard to find, compare/export mixed, fit/gap header overflow) | chat; fixed in 1e29ecd |
| Long text (session 22 note, desktop + phone width) | 7 Nov 2026, ~13:50 WIB | Farros: "yes" (the long decision note wrapped cleanly) | chat |
| Empty state (new assessment, no candidates) | 7 Nov 2026, ~13:55 WIB | Farros saw: "Candidates · No candidates yet · Click 'Invite Candidate' to generate an interview link." Small copy nit noticed by Claude: "1 skills" (pluralisation), not fixed | pasted in chat |

All planned personal checks are done.

## Scope and revision

Farros ran the tests above before UX fix `1e29ecd`. His UI observations are reported in the table, including finding F1–F3 himself; this does not claim he re-ran the post-fix gates. Post-fix tests and browser checks were agent-run: [walkthrough-ux-check.md](walkthrough-ux-check.md).

## Saved output tails

Final two non-empty lines of each saved output, with blank lines omitted. Original filenames are local evidence references, not repository links; no local absolute paths are included.

### RSpec

```text
112 examples, 0 failures
Randomized with seed 36441
```

### Vitest

```text
   Start at  12:48:23
   Duration  2.74s (transform 369ms, setup 0ms, collect 560ms, tests 195ms, environment 2ms, prepare 3.80s)
```
