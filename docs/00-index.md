# Documentation Index

**Provenance: `[BRIEF]` — Step 6.**

> **The platform gathers good evidence and then destroys it on the way to the reader.**

This documentation set is the working evidence for the case study submission. Each document is referenced by [`assessment/report.md`](../assessment/report.md); the report is the argument, these are the artefacts.

---

| Doc | Title | Purpose |
|-----|-------|---------|
| [01](01-domain-immersion.md) | Domain Immersion | Five pillars; the provenance-as-moat argument |
| [02](02-architecture.md) | Architecture | System map; the computation seam |
| [03](03-findings-register.md) | Findings Register | 56 findings; constraint signals; credit where due |
| [04](04-acceptance-criteria.md) | Acceptance Criteria | Every input scenario and edge case |
| [05](05-trade-offs.md) | Trade-offs | Twelve decisions, with rejections |
| [06](06-testing.md) | Testing | Harness from nothing; the six seeded faults |
| [07](07-local-dev.md) | Local Development | Docker Compose, stub mode, fixtures |
| [08](08-migration-safety.md) | Migration Safety | Per migration: forward, back, existing rows |
| [09](09-uu-pdp.md) | UU PDP Compliance | Data inventory; Art. 10 analysis |
| [10](10-design-system.md) | Design System | Design direction; the anchor rail |
| [11](11-ai-verification-log.md) | AI Verification Log | Where AI was wrong, and how it was caught |
| [12](12-screenshot-plan.md) | Screenshot Plan | 27 shots and their fixtures |
| [13](13-deployment.md) | Deployment | Production gaps; scaling ceiling |
| [14](14-backlog.md) | Backlog | What was deliberately not done |

---

## Provenance Tags

Each document carries a provenance tag indicating its source:

- `[BRIEF]` — derived from the case study brief
- `[CODE]` — derived from reading actual source code with file:line references
- `[SPEC]` — a specification that was missing and needed to be written
- `[IMPL]` — an implementation defect observed in the codebase

## How to Read

1. Start with `report.md` for the narrative argument
2. Each claim in the report links to a specific section in these docs
3. Every finding has a `file:line` reference — verify it against the actual code
4. The docs are honest: unverified claims are marked as such

## Notation

- `P0`–`P3`: severity levels (P0 = critical, P3 = low)
- `[SPEC]`: missing specification nobody defined
- `[IMPL]`: defective implementation
- `C1`–`C4`: constraint signals requiring escalation before code
- `TO-1`–`TO-12`: trade-off decisions with chosen and rejected options
