# 05 — Trade-offs

**Provenance: `[CODE]` + `[SPEC]`.**

Twelve decisions (TO-1 through TO-12), each with 2-3 options, chosen option, rejected options with reasoning, and deferred items.

---

## TO-1: Verdict Storage

**Options:**
- A) Enrich JSONB on the `fit_gap_reports` row (chosen)
- B) Compute-on-read from `portfolio_skills` + `vacancy_skills`
- C) Normalised `fit_gap_comparisons` table

**Chosen:** A — Enrich JSONB. A report acted on in March must not change in June because someone edited the vacancy. Point-in-time artefact semantics require materialisation.

**Rejected:**
- B (compute-on-read): Genuinely tempting — deletes a whole class of bug. Rejected because it breaks the product semantic. Also what Art. 10 assumes when a decision is contested.
- C (normalised table): Over-normalised for the current scale. Adds join complexity without benefit.

**Deferred:** None.

---

## TO-2: Override Protection

**Options:**
- A) Upsert by `portfolio_skill_id` (chosen)
- B) Portfolio versioning

**Chosen:** A — Upsert by skill label. Simple, idempotent, sufficient for single-assessor-per-portfolio model.

**Rejected:**
- B (versioning): Over-engineered for current scale. Would require snapshotting entire portfolio on each override.

**Deferred:** Portfolio versioning if multi-assessor editing is needed.

---

## TO-3: Unrated Levels

**Options:**
- A) Nullable `ai_level` + `rating_state` enum (chosen)
- B) Boolean `is_rated` flag
- C) Sentinel value `0`

**Chosen:** A — Nullable `ai_level` with `rating_state: "rated" | "unrated"`. Clean semantic; `nil` means "not rated", integer 1-5 means "rated".

**Rejected:**
- B (boolean): Loses the distinction between "rated L1" and "not rated".
- C (sentinel 0): `nil.to_i.clamp(1,5)` already does this — it is the bug being fixed.

**Deferred:** None.

---

## TO-4: Contract Enforcement

**Options:**
- A) Zod at the boundary (chosen)
- B) Rename fields only
- C) OpenAPI generation

**Chosen:** A — Zod schemas validate API responses at the TypeScript boundary. Runtime safety without build complexity.

**Rejected:**
- B (rename only): Does not prevent future mismatches.
- C (OpenAPI): Heavyweight for current team size. Requires server-side OpenAPI spec maintenance.

**Deferred:** OpenAPI if the API grows beyond 20 endpoints.

---

## TO-5: Tenant Scoping

**Options:**
- A) Denormalise `tenant_id` + `TenantScoped` concern (chosen)
- B) Policy objects (Pundit/CanCanCan)
- C) Join-layer scoping

**Chosen:** A — Every model with `tenant_id` includes `TenantScoped`. Automatic, consistent, minimal ceremony.

**Rejected:**
- B (policy objects): Adds abstraction without solving the core problem (missing membership model).
- C (join-layer): Complex; fragile with multi-schema PostgreSQL.

**Deferred:** Policy objects when C1 (membership model) is resolved.

---

## TO-6: Idempotency

**Options:**
- A) Status column + advisory lock (chosen)
- B) Redis unique-job

**Chosen:** A — `generation_status` column + PostgreSQL advisory lock. Works without Redis dependency for the lock itself.

**Rejected:**
- B (Redis unique-job): Adds Redis dependency for idempotency. Redis is already used for Sidekiq but advisory lock is simpler.

**Deferred:** None.

---

## TO-7: Confidence Threshold

**Options:**
- A) Tiered verdicts: `low` → `insufficient_evidence`, `medium` → caveated, `high` → plain (chosen)
- B) Suppress low-confidence verdicts entirely
- C) Show verdict with annotation for all

**Chosen:** A — Tiered approach. `low` confidence yields `insufficient_evidence` (delta shown, not asserted). `medium` yields a caveat. `high` yields a plain verdict.

**Rejected:**
- B (suppress): Loses information. A hiring manager should see the delta, even if not asserted.
- C (annotate all): Too noisy. High-confidence results should be plain.

**Deferred:** **This decision is flagged for ratification.** It decides what the product asserts about a person on thin evidence. That belongs to the CTO, not to a service object.

**Reasoning:** The proposal maps confidence to product assertion:
- `low` → "we did not ask enough" (not asserted)
- `medium` → "we asked, but the evidence is thin" (caveated)
- `high` → "we asked, and the evidence is clear" (plain)

---

## TO-8: Local Dev

**Options:**
- A) Docker Compose (chosen)
- B) Devcontainer
- C) `mise` fast path

**Chosen:** A — Docker Compose with separate API and web compose files. Reproducible, well-understood, no VS Code dependency.

**Rejected:**
- B (devcontainer): VS Code dependency. Not all developers use VS Code.
- C (mise): Requires manual PostgreSQL/Redis setup. Less reproducible.

**Deferred:** None.

---

## TO-9: Gemini in Tests

**Options:**
- A) Injectable stub client (chosen)
- B) VCR cassettes

**Chosen:** A — `Gemini::StubClient` with fixture-backed modes. Same interface as `HttpClient`, per-call injectable failure modes.

**Rejected:**
- B (VCR cassettes): Cassettes of interview transcripts are personal data. Committing them would put candidate speech into version control. Privacy disqualifier.

**Deferred:** None.

---

## TO-10: PDF Unicode

**Options:**
- A) Embed TTF font (chosen)
- B) Sanitise text to WinAnsi
- C) HTML→PDF

**Chosen:** A — Embed a TTF font that supports Indonesian characters. Zero product compromise.

**Rejected:**
- B (sanitise to WinAnsi): Zero dependencies, and it mangles Indonesian candidate quotes. This is an evidence document; corrupting the evidence to satisfy the renderer inverts the product's purpose.
- C (HTML→PDF): Heavier dependency (Puppeteer/wkhtmltopdf). Adds deployment complexity.

**Deferred:** None.

---

## TO-11: Test Isolation

**Options:**
- A) DatabaseCleaner truncation (chosen)
- B) Transactional fixtures

**Chosen:** A — Truncation after every example. Robust across `schema_search_path` ("ai_interview,public"), seven native PG enums, and advisory locks.

**Rejected:**
- B (transactional): Does not guarantee the right schema is rolled back with multi-schema `search_path`. Nested transactions with PG enums and advisory locks produce intermittent, confusing failures.

**Deferred:** None.

---

## TO-12: PR Structure

**Options:**
- A) Umbrella PR + waves (chosen)
- B) Single PR

**Chosen:** A — Umbrella PR with 4 waves (0-3). Each wave is a logical unit: infrastructure, tenant isolation, defensible ratings, reliability.

**Rejected:**
- B (single PR): Too large to review meaningfully. 56 findings addressed in one diff is unreadable.

**Deferred:** None.
