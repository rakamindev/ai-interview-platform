# Seeded Fault Evidence

## Purpose

The portfolio normalizer must preserve `not_assessed` when a model response has no reliable rating. This evidence demonstrates that the regression suite catches a deliberate implementation fault.

## Scratch branch

- Branch: `evidence/seeded-fault-portfolio-normalizer`
- Fault commit: `46abd90 evidence: seed incorrect assessed status`
- Revert commit: `f6d8aca Revert "evidence: seed incorrect assessed status"`

## Red run

The fault changed the fallback `rating_status` from `not_assessed` to `rated` in `api/app/services/portfolios/result_normalizer.rb`.

Command:

```text
rspec spec/services/portfolios/result_normalizer_spec.rb
```

Observed result:

```text
5 examples, 2 failures
```

The failures were the missing-rating case and the invalid-model-level case. Both expected `not_assessed` and received the seeded incorrect `rated` value.

## Green run after revert

The fault commit was reverted on the same scratch branch. The same command then produced:

```text
5 examples, 0 failures
```

The feature branch does not contain either scratch-branch commit. The visible scratch history remains available through the two commit hashes above.
