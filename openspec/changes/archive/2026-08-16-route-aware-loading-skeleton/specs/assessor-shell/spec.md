## MODIFIED Requirements

### Requirement: Branded loading fallback
Authorized routes SHALL render the assessor variant of the shared route-aware branded skeleton for lazy route loading, instead of plain "Loading..." text. The branded skeleton is no longer exclusive to authorized routes; the assessor silhouette is its default variant, while auth and interview routes render their own silhouettes (see the `route-loading-skeleton` capability).

#### Scenario: Lazy route loading
- **WHEN** an authorized route chunk is loading
- **THEN** the fallback shows the branded skeleton with the assessor silhouette (top nav + wide content)
