# Remediation checks - 6 Nov 2026

Changes remain uncommitted; no publication or deployment. This extends, not rewrites, the earlier 96/26 checkpoint.

- api: `PATH=/Users/farros/.rbenv/versions/3.3.2/bin:$PATH bundle exec rspec spec/requests/assessment_deletion_spec.rb` before fix: 3 examples / 1 failure; expected 422 but got 200; seed 21380.
- web: `npx vitest run src/stores/authAtom.test.ts` before fix: 3 tests / 1 failure; production returned synthetic development fallback.
- api full `bundle exec rspec` after fix: 99 examples / 0 failures; seed 57150. Existing PDF-provenance regressions included.
- web `npm test`: 29/29, 3 files (15 portfolio + 11 outcome + 3 auth), repeated after Vite config correction and passed.
- web `npx tsc --noEmit`: pass. `npm run build`: pass.
- web `npx tsc --noEmit -p tsconfig.node.json`: FAIL missing Node path/__dirname declarations. Baseline already imports Node path and uses __dirname; no newly invented type stubs added. Intentional Node dev-type dependency and lockfile work remains open.
- web `VITE_DEV_TOKEN=RAKAMIN_SYNTHETIC_DEV_TOKEN_MUST_NOT_SHIP npm run build`: runtime-only fix still included sentinel in vendor-misc. Local Jotai source accesses the whole import.meta.env object; Vite source serializes allowed environment data. Added build-only public env allowlist plus existing runtime DEV guard. Rebuilt all production files scanned: sentinel absent. No real development token printed.
- W19 actual browser: /assessments/3/sessions/14/fitgap/3 shows AI suggested L2 · low coverage confidence. S9/S10 refreshed; no confirmed wording in that view. No live provider call.
- Root npx invocation for optional tooling check was stopped and rerun from web; no result from that stopped invocation is counted.

No CI or Docker/cluster verification added. No measured latency/ROI/usability/validity result invented. Wider security/governance/audio issues remain in remediation-plan.md. Candidate-personal checks unconfirmed and practice paused.

## Artifact and decision reconciliation

- Report revised to 14 pages with opportunity selection, integrated genuine screenshots/detail crops, current 99/29 counts, open Vite-config tooling check, explicit missing PR/video links and unconfirmed personal checks. Original editable first draft archived; JSON/prose/ReportLab builder retained. All pages rendered/reviewed as thumbnails and selected detailed pages reviewed; a clipped screenshot header was corrected and the two changed pages re-rendered/reviewed.
- Decision map: 18 semantic groups, 95 changed-path mappings, 108 code-hunk entries. This is retrospective source-grounded navigation, not invented contemporaneous intent or candidate review. Separate framework rows mapped without renumbering original D IDs.
- 60% hint threshold has no found empirical numerical justification; coverage confidence implements the PRD rule rather than calibrated correctness; six retries has recorded bounded-recovery intent but no cost-optimality benchmark.
- W19 has source/types/build/browser verification, not a newly added dedicated automated label regression. B7 and W28 have focused failing-before/passing-after cases.
- Repeated bounded credential scan: zero matches in 238 tracked files / 308 historical blobs across all refs. New text artifacts checked separately; neither scan establishes comprehensive absence of secrets or PII.
- Optional tooling check generated web/tsconfig.node.tsbuildinfo; only that newly generated cache was removed. Pre-existing dump.rdb and package-lock.json are untouched.
- New product changes stopped after the documented bounded corrections. No commit, push, PR, video publication, deployment or submission. User practice remains paused.
