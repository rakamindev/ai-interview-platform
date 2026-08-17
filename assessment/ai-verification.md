# AI verification log

[VERIFIED-CODE] AI-assisted analysis was checked against source locations; runtime claims were retained only where established runtime evidence was supplied.

[VERIFIED-CODE] “Nil skill_label causes NoMethodError” was disproved by `null: false` and presence validation; lesson: validate reachable data states before predicting an exception.

[VERIFIED-CODE] A migration draft omitted non-null `assessor_overrides.ai_level`; lesson: inspect schema constraints before drafting migrations.

[VERIFIED-CODE] “Override endpoint unreachable because assessor does not exist” was disproved by `application_controller.rb:12`; lesson: read authorization semantics, not role names alone.

[VERIFIED-CODE] “JWT tenant claim is tenant_id” was disproved because authentication signs `scheme`; lesson: decode the exact claim source.

[VERIFIED-RUNTIME] “Wrong port only in README” was disproved by the established `.env.example` observation; lesson: inspect shipped configuration.

[VERIFIED-RUNTIME] “Configured-but-omitted skills are dropped” was disproved by `not_assessed`; lesson: this retraction revealed the existing uncertainty vocabulary.

[VERIFIED-RUNTIME] “delta 0 renders missing” was disproved by Match rendering; lesson: test display branches.

[VERIFIED-RUNTIME] “Fit/gap is not clickable” was disproved by the Portfolio Results action; lesson: follow the user journey.

[VERIFIED-CODE] Reading code establishes what code says; only running it establishes what the product does, which is why this report labels every claim.
