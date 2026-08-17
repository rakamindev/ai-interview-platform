# Findings appendix

[VERIFIED-CODE] `sessions` has no `updated_at` although status and duration fields mutate; this is an auditability limitation, not evidence of a runtime failure.

[VERIFIED-CODE] `assessor_overrides` validates 1–5 without `allow_nil` and depends on a database uniqueness constraint rather than a matching model validation.

[VERIFIED-CODE] Portfolio generation uses temperature `0.2`; this makes a scoring artefact non-deterministic.

[VERIFIED-CODE] `portfolio_generator_worker.rb` broadly rescues `ActiveRecord::RecordNotFound`, so a missing session and another swallowed lookup cannot be distinguished from the log alone.

[VERIFIED-CODE] `find_portfolio_skill` in `api/app/services/fit_gap/engine.rb:88-90` downcases a label without strip or nil guard.

[VERIFIED-CODE] Positive controls: JWT decode pins `HS256`; `portfolio_skills` has a 1–5 database check; and `fit_gap_reports` has a unique `(portfolio_id, vacancy_id)` index.

## Retracted claims

[VERIFIED-CODE] “The override endpoint is unreachable because assessor does not exist” was retracted because `application_controller.rb:12` allows admin through the assessor guard.

[VERIFIED-RUNTIME] “Configured-but-omitted skills are dropped from fit/gap” was retracted because the established payload emits them as `not_assessed`.

[VERIFIED-RUNTIME] “delta 0 renders as missing data” was retracted because the established UI rendered Match.

[VERIFIED-RUNTIME] “Fit/gap cannot be reached by clicking” was retracted because Portfolio Results exposes a vacancy selector and Run Fit/Gap Analysis action.

[VERIFIED-CODE] “Nil skill_label causes NoMethodError” was retracted because schema nullability and model presence validation exclude that state.

[VERIFIED-CODE] “JWT tenant claim is tenant_id” was retracted because the authentication controller signs `scheme`.

[VERIFIED-RUNTIME] “The wrong port is only in the README” was retracted because the established observation found it in `.env.example`.
