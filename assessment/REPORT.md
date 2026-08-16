# Product Engineer Case Study — Submission Report

**Candidate:** Ukino  
**Repository:** github.com/rakamindev/ai-interview-platform  
**Branch:** `feature/honest-skill-verdict`  
**Pull Request:** https://github.com/rakamindev/ai-interview-platform/pull/22  
**Video walkthrough:** _(record 3–5 min using script below; paste Loom/YouTube link here)_

---

## 1. Execution journey

### Step 1 — Setup & exploration

I cloned the monorepo, ran the Rails API on port 3001 and the Vite web app on 5173. I walked assessor flows (create assessment → invite → monitor) and the candidate interview path (`/interview/:token`). I read `api/README.md` and traced session end → Sidekiq → portfolio generation.

### Step 2 — Product context

**Users:** Recruiters and hiring managers in Indonesia who need defensible skill signals without running every live interview themselves.

**Candidates:** People assessed without choosing the tool. A fabricated L1 on a skill they never discussed can change hiring outcomes — UU PDP applies to automated scoring used in decisions.

**Product outcome:** Assessors should trust the portfolio and fit/gap report enough to shortlist, probe further, or reject with confidence.

### Step 3 — Problem & gap analysis

| Severity | Finding | Impact |
|----------|---------|--------|
| **P0** | Portfolio generator clamps missing Gemini `level` to L1 | "Not discussed" looks like "weak" — unfair to candidates |
| **P0** | Gemini asked to rate all coverage skills including `not_yet` | Invented evidence risk |
| **P1** | Fit-gap `not_assessed` never fires when fake L1 exists | Vacancy comparison misleading |
| **P1** | UI `required_level` vs API `expected_level` | Required column blank in fit-gap table |
| **P1** | Invalid interview token → "Interview Complete" | Candidate thinks they finished |
| **P2** | No RSpec specs, no web tests, no CI | Cannot prove regressions |
| **P2** | Portfolio page blank when load fails | Assessor sees empty screen |
| **P3** | Generic card stack UI | Hard to scan mixed assessed / not assessed |

**Missing spec vs broken implementation:** `not_assessed` was specified in fit-gap enums but portfolio generation never produced null levels — defective implementation.

**Constraint signal (escalate to TL):** JWT trusted without DB lookup; tenant scheme from unverified JWT in middleware; invite tokens without expiry. Not fixed in this slice — auth hardening is a separate release.

### Step 4 — Strategy & trade-offs

**Goal:** Stop inventing ratings; show honest verdicts on portfolio and fit-gap.

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A — Deterministic pre-pass** | Auditable, no Gemini cost on untouched skills, nullable DB | Migration + generator refactor | **Chosen** |
| **B — Prompt-only** | Small diff | `clamp(1,5)` still forces L1 | Rejected |
| **C — Hire/no-hire engine** | Flashy product | New surface, governance, deadline risk | Rejected |

**Acceptance criteria (self-derived):**

- `not_yet` never produces `ai_level` 1–5
- `initiated` with `probe_count < 2` → `not_assessed`
- Assessed skills still get level, evidence, confidence from Gemini
- Gemini failure → failed portfolio + retry UI
- Fit-gap Required column correct; `not_assessed` counted
- Override on not_assessed allowed (human accountability)
- Invalid token ≠ success screen
- Reversible migration; no PII in logs

### Step 5 — Implementation

Full-stack slice on `feature/honest-skill-verdict`:

- **Backend:** Migration, `Portfolios::Generator` pre-pass, `FitGap::Engine` nil-safe comparisons, portfolio JSON `session_verdict`, PDF export
- **Frontend:** Verdict strip, assessed / not assessed layout, fit-gap fixes, interview error state
- **Tests:** RSpec + Vitest + GitHub Actions CI
- **Docs:** `docs/honest-skill-verdict.md` (technical deep-dive for interview prep)

**Claimed depth:** Backend-heavy scoring correctness with a complete frontend decision surface.

### Step 6 — Verification

**Automated:**

```bash
cd api && bundle exec rspec
cd web && npm test
```

**Seeded fault:** Spec `expect(skill.ai_level).to be_nil` on not_assessed skills fails if `save_not_assessed_skills` sets `ai_level: 1` (the old clamp behavior). I verified by temporarily applying that one-line regression locally; restoring `nil` makes the suite pass again.

**AI verification:** Rejected prompt-only fix because `to_i.clamp(1, 5)` still coerces nil → 1. Verified by reading `save_skills` and writing failing spec for missing level.

**Manual QA checklist:**

- [ ] Portfolio with mixed coverage shows verdict strip and split sections
- [ ] Fit-gap Required column shows L1–L5
- [ ] Bad interview URL shows error
- [ ] Failed portfolio shows error + retry

---

## 2. Visual evidence

_Screenshots to embed in PDF:_

1. Portfolio verdict strip (assessed / not assessed counts)
2. Not assessed skill card (em dash, no L1 badge)
3. Fit-gap table with not assessed row and summary
4. Interview invalid link error screen
5. Mobile-width portfolio layout

---

## 3. Video script (3–5 minutes)

1. **Problem (45s):** Show old behavior conceptually — skill never discussed still shows L1. Why that breaks hiring trust.
2. **Assessor flow (90s):** End session → portfolio generating → verdict strip → assessed vs not assessed sections → override on one skill.
3. **Fit-gap (60s):** Pick vacancy → table with Required column → not assessed count in summary.
4. **Candidate fix (30s):** Bad token → error screen.
5. **Engineering (60s):** Pre-pass diagram, migration nullable levels, point to tests and CI.
6. **Close (30s):** What I'd escalate next (auth, invite expiry).

---

## 4. Pull request

GitHub PR link: https://github.com/rakamindev/ai-interview-platform/pull/22

---

## 5. Related documentation

Detailed technical reference: [`docs/honest-skill-verdict.md`](docs/honest-skill-verdict.md)
