# Council implementation freeze — 7 November 2026

Supersedes the implementation/count portion of the earlier freeze only. Application/spec/migration HEAD is `2789bbc248b73a361c7437ece7417f4499c3f4b2` (`2789bbc`); the feature branch was fast-forwarded from `e511d58` to that commit after Farros accepted the independent gate rerun. This documentation commit records those checks; it does not introduce more application changes. Historical outputs retain their historical counts.

## Changes and gates (agent-run)

- `806d0e3`: lock generation during publication, separate-connection reclaim regression.
- `2789bbc`: legacy-backfill key collisions, repeatable down/up regression. The edited migration is new in this PR and has never run in production.
- Both new regressions have one failing example before the patch and one passing example after it: `../council-c1-red-green.txt`, `../council-a2-red-green.txt`. C1 red: claim unexpectedly true. A2 red: PG::UniqueViolation.

| Check | Recorded result / provenance |
|---|---|
| `bundle exec rspec` | Codex: 107 examples, 0 failures; seed 65274, 5.84 s. Claude independently reports 107/0. |
| `npm test -- --run` | Claude: 3 files passed; 29 tests passed (29). |
| `npx tsc --noEmit` | Pass in both shells; no output from Codex run. |
| `npm run build` | Claude: pass, built in 4.35 s; index-B_oC_9xY.js 194.65 kB. |
| Six-pattern tracked + reachable-history scan | Codex: 256 tracked files, 358 historical blobs; zero matches. `../council-secret-scan.json`; bounded patterns, not proof of no secrets/PII. |
| Diff credential grep / commit trailers | Claude: zero grep hits; no AI trailers. |
| Development DB backfill up/down/up | Codex: pass on synthetic temporary table clones in rakamin_development; six rows, distinct normalized keys, first configured identity retained; rolled back and original table counts unchanged. `../council-dev-migration-up-down-up.txt` and reproduction script. Clones retain column/index constraints but not foreign keys; the regression spec uses the actual test schema. Not production rollback proof. |

`../council-gates-claude.txt` is a verbatim copy of Claude's supplied shell-run summary, not the full raw frontend terminal transcript. `../council-full-gates.txt` retains Codex's raw backend output and the initial sandbox-only frontend stalls. The alternate-loader diagnostic failed on __dirname; the ordinary frontend gates passed in Claude's shell. Those sandbox observations are not application regression failures, and Codex does not claim to have personally rerun the passing frontend checks.

## Scope and remaining limits

Only Council C1 and A2 were fixed in code. Findings now disclose A1, A3–A7, S1–S6 and the C2 wording correction with triage origin/severity. A1: after unexpected error/killed worker during first scoring, immediate Sidekiq retry is a no-op; spinner has no Retry button; API regenerate works after 10 minutes. No recovery fix is implied.

B1 remains a multi-tenant release blocker. Deployment, CI, live provider/audio, fresh-machine installation, competency validity, empty/long-text UI checks and Farros's personal checks remain unverified/pending as previously stated. H2 remains exploratory, not supported and not merged. No push, PR or publication. The report's recorded screenshots were not recaptured for these backend fixes.

## Report and documentation check

The external report was rebuilt once after layout preflight, remains 14 pages, and all 14 page renders were visually inspected by Codex (header SHA changed throughout). No clipping/overlap found. Content changes: p1 implementation; p3 counts; p6 generation row lock; p12 C1/A2 regressions; p13 precise limits; p14 council AI verification. Page 9's stacked crops remain. Native tables and all TC-01–TC-14 criterion text retained. PR/video, empty/long-text UI states and personal verification remain pending.

PDF: `Research/engineering/submission/output/pdf/human-in-the-loop-review.pdf` (outside repository); SHA-256 `4cec14ff831b8a0b17489a028160fc50378d070c59341c16da57b6dce30de86d`. Selectable-text checks confirm 14 pages, current implementation SHA on every header, both regressions, 107/29 counts and the requested council limits. Report source/builders and PR description are saved outside the repository, not part of the docs commit.

Final documentation scan before commit: 265 tracked/staged files and 358 historical blobs, zero six-pattern matches (`../council-docs-secret-scan.json`). This does not establish absence of arbitrary secrets or personal data. Staged scope checked: assessment documentation/evidence only; no api/web files.
