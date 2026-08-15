# Assumptions

No live Q&A was available, so each ambiguity was resolved, recorded here, and
work continued.

1. **No `GEMINI_API_KEY` was available.** Every AI-dependent path — portfolio
   generation, coverage analysis, fit/gap narrative — is unreachable without
   one. All are exercised through `Gemini::StubClient`, injected via the
   `gemini_client:` parameter each service already accepted. Fixtures are
   derived from the prompt contracts in the existing code.

   The architectural signal underneath this: the codebase had no seam for
   running without the vendor, which is also why it had no tests. The seam was
   designed and never used.

2. **The wiki linked from the root README is treated as unavailable.** Product
   intent is inferred from the code, the schema, and the brief.

3. **The assessor is the primary user of the surface being revamped.**
   Recruiters and hiring managers consume its output; candidates are the
   subject of it and are designed for explicitly, per the brief's fifth pillar.

4. **The L1–L5 anchors and the four-state coverage model are settled product
   decisions** and were not relitigated. The defects addressed are in how those
   models are applied, not in the models themselves.

5. **Existing `portfolio_skills` rows are backfilled to `assessed`.** They were
   all written under the old always-rate contract, so it is the only truthful
   backfill available — even though some of them are certainly fabricated L1s.
   Retroactively identifying which would require the original coverage maps and
   is out of scope; it is noted as follow-up work rather than guessed at.

6. **The migration's `down` path deletes unrated rows.** The pre-migration
   schema cannot represent a skill without a level. The alternative is
   back-filling the exact fabricated number the migration exists to remove.
   The deletion is scoped to unrated rows and announced in migration output.

7. **`expected_level` is retained as a deprecated alias** of `required_level`
   for one release, so an unmigrated client does not break on deploy.

## Deliberately out of scope

Stated with reasons, because what was left alone is part of the judgement being
assessed.

- **P1-7, the `find_map` nil-id collision, and P2-14, `advance_stale_partials`.**
  Both are in the live-interview coverage path. Validating a change responsibly
  needs a real Gemini key and live session data; altering state-machine
  thresholds without either is guessing at behaviour that decides what a
  candidate is asked.
- **The audio and WebSocket layer.** No microphone, no key, no way to verify.
- **UU PDP retention and erasure policy.** The cross-tenant leak is the acute
  breach and is fixed. A retention schedule, candidate-facing access, and
  rectification rights are a product decision requiring a data controller's
  input, not an engineering default.
