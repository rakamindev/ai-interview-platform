# Council round-two implementation freeze — 7 November 2026

Application/specification code is `28010587bc495a78f77d8f63d12be13f6d475871` (`2801058`). Farros accepted Claude's independent verification and approved fast-forwarding `fix/council-round2` into `feat/trustworthy-assessment-lifecycle`. Later commits in this approved round are documentation/evidence only; no further application changes are included. Prior freeze records remain historical.

## Bounded changes and evidence

- `8e70fd7`: failure/reclaim row-lock fence. `../council-r2-fail-red-green.txt`: 1 example/1 failure (B claimed true) → 1/0 (B false, claim_count 1).
- `2801058`: discovered identity, carry-forward, both stale-save lookups, API orphan serialization and recorded same-generation rejection. `../council-a4-red-green.txt`: 4 examples/3 failures → 4/0; same-C++ control passed both sides. No pre-existing assertion or frontend source changed.
- Comparison only: configured `assessment_skill:<id>` unchanged; discovered identity requires equal skill_key and equal labels after strip/downcase/space-squeeze. No database key migration. Same-generation collision still stores one skill and records the rejected label; punctuation variants such as React.js / React JS are flagged, not silently moved.

## Gate provenance (agent-run, synthetic)

| Command/check | Codex captured output | Claude independent rerun summary |
|---|---|---|
| `bundle exec rspec` | 112 examples, 0 failures; seed 13922, 6.85 s | 112 examples, 0 failures |
| `npm test` / Claude `npm test -- --run` | 3 files passed, 29 tests passed | 3 files passed, 29 tests passed |
| `npx tsc --noEmit` | Exit 0 | Pass |
| `npm run build` | Exit 0; 1844 modules, built in 6.20 s | Pass; built in 5.04 s |
| Secret scan | Six patterns: 273 tracked/staged files, 372 historical blobs, zero matches | Diff grep: zero hits |
| Existing specs / trailers | No existing spec assertion changed | No existing spec files changed; no AI trailers |

Codex's raw combined output: `../council-round2-gates.txt`; scan: `../council-round2-secret-scan.json`. `../council-round2-gates-claude.txt` is copied verbatim from Claude's supplied shell-run summary, not a full raw terminal transcript. Claude also reviewed the diff. The scan is bounded, not proof of absence of arbitrary secrets/PII. No live provider or browser execution is claimed for this round. API assertions exercise orphan visibility; existing UI earlier-decision routing was inspected in source.

## Unchanged boundaries

A5 remains open: valid JSON without usable skills can publish all Not rated and block regeneration. A1's first-scoring spinner/API-only recovery, A3, A6/A7, S1–S6 and B1 remain disclosed. S4 is an operator-triggered cross-tenant destructive task without a production guard. S5's ambiguous tenant resolution/default fallback can satisfy both resolver and signed-claim binding. Original triage grades are retained, not treated as mitigation of harm.

PR/video links, empty/long-text UI checks and Farros's personal checks remain pending. H2 is exploratory, not supported, not merged. No push or publication.

## Report verification

Single PDF rebuild after layout preflight; 14 pages. Every rendered page was visually inspected by Codex: no clipping or overlap found, existing font sizes retained. Page 12 cell padding reduced from 4 to 3.5 pt to fit full spec names; all TC criterion text remains. Content updates: pp1/3 implementation/counts, p2 title, p7 identity/mismatch, p12 spec citations, p13 remaining A4/A5/S4/S5 limits, p14 round-two review and code/docs distinction. Headers updated throughout; page 9 crops preserved. Native text checks confirm these items and all 14 TC IDs.

External PDF: `Research/engineering/submission/output/pdf/human-in-the-loop-review.pdf`; SHA-256 `5a131097dd1f7cc0a35da662ec39fe10f0bebc6054f6e39f83303b90109ddd5a`. Source/builders, generated report and PR description are saved outside the repo, not committed here. Screenshots are historical recorded captures, not new browser verification.
