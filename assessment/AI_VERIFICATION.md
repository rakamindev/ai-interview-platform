# AI verification log

The implementation and documentation were developed with AI assistance. The candidate must review and understand the code before submission and live defense.

## Initial AI-authored access check needed a stronger trust boundary

The first generated controller patch constrained portfolio rows by `current_tenant_id`, but did not bind the resolved tenant to the authenticated JWT. Review found that tenant resolution happens before authentication and supports a header fallback. A signed token with no scheme must not be allowed to select an organization through that header. Added `verify_authenticated_tenant!` after role authentication and a request regression test for this specific case. This is an actual correction to the AI-authored implementation, not a fabricated model incident. Execution evidence is recorded with the Rails test results.

## Observed failure: historical confidence should not overrule the effective source

The initial generated filter treated low AI confidence as follow-up even after a human rating replaced that AI rating. A new regression case exposed the mistake: one failed test and four passing component tests, recorded in `evidence/ai-verification-ui-fault.txt`. The corrected filter uses low confidence only when the effective rating source is AI, while keeping historical AI confidence visible. Gaps and missing assessments still need follow-up regardless of source. Existing assertions were retained and the low-confidence fixture was made explicit about using an AI rating.

## Observed failure: global test tools masked an undeclared import

The generated `spec_helper` initially required the `rspec` metagem. Standalone checks could see that globally installed metagem, but the application's bundle declares `rspec-rails` and its component dependencies. The bundled suite failed to load. Corrected the helper to require `rspec/core`, which is an actual declared transitive dependency; preserved the failure output in `evidence/ai-verification-harness-fault.txt` and reran the suite inside Bundler.

## Verified risky assumption: frontend tests alone prove fullstack correctness

The first complete Rails/PostgreSQL run executed 43 examples and found two failures: the empty-vacancy engine and PDF export cases. The generated exclusion validator rejected an empty array. Replaced it with an explicit array-type check, preserving rejection of nil/non-array data while allowing an unconfigured vacancy. Both workflow assertions were kept; the original failure is in `evidence/ai-verification-empty-report-fault.txt`.

The generated frontend tests mock API clients. They prove rendering and recovery behavior, but cannot prove tenant isolation or database atomicity. Review identified this limitation. Separate PostgreSQL-backed Rails request/service specs were added for cross-tenant access, export, overrides, stale reports, and failure rollback. Browser contract tests are explicitly labeled synthetic fixtures and are not represented as live-API coverage.

## Verified risky contract: generated level types

The original frontend describes `PortfolioSkill.ai_level` as a string and `SkillComparison.required_level`, while database/API emit integer levels and `expected_level`. Following those types would produce a blank required-level column. The implementation checks the Rails serializer and schema, updates the shared contract, and asserts actual L3/L4 text using an API-shaped fixture. Do not fix this by defaulting missing values to L1.

## Verified setup failure

An initial Windows test run failed because esbuild could not read an ancestor directory under the restricted sandbox. The same assertions passed outside the sandbox. This is recorded as an environment failure, not a product test failure. The first cold browser navigation exceeded 30 seconds while Vite compiled the application; the browser suite allows 90 seconds for cold startup without removing assertions.

Final test results are recorded separately from these observations. No unexecuted Rails test is counted as passing.

## PDF glyph found during visual verification

The actual API PDF export rendered the Unicode arrow between AI and override levels as a missing glyph with the bundled font. The first-page render exposed it despite the API returning a valid PDF. Replaced that separator with ASCII `->`; the numerical ratings and provenance are unchanged. The actual API export was generated and both pages rendered again; the separator is now readable.
