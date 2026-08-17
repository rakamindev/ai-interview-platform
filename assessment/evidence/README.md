# Evidence index

[VERIFIED-RUNTIME] `fitgap-report-before.json` is the supplied pre-change fit/gap response and proves `expected_level`, `not_assessed`, the false-L1 gap, and the fallback narrative count.

[VERIFIED-RUNTIME] `ruby-clamp.txt` records the reproducible coercion command and output.

[VERIFIED-RUNTIME] `login-tenant-claims.txt`, `fitgap-generation-lifecycle.txt`, and `coverage-response.txt` transcribe the supplied established runtime observations; bearer tokens are intentionally redacted and no secret is committed.

[HYPOTHESIS] `tampered-token-outcome.txt` is deliberately marked not verified because the API server became unreachable before this assessment could rerun the requested probe; a reachable API and valid test token would prove the outcome.
