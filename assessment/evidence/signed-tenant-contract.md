# Signed tenant binding: approved bounded patch (6 November 2026)

Review base: `21bb9a1`. This patch changes HTTP signed-tenant binding, adds its synthetic regressions and corrects the stale assessor-regeneration comment. Local login, membership, WebSocket behavior and infrastructure are unchanged. Earlier uncommitted corrections are not bundled into this commit.

## Compatibility check, before implementation

- Local login, seeds and `.irbrc` mint signed tokens with scheme; those known paths remain compatible.
- Whether legitimate rakamin-api tokens omit scheme is unknown. Such tokens now receive 401 and must be updated before rollout.
- HTTP Bearer requests previously fell back to X-Tenant-Scheme or Referer when scheme was absent. That behavior is intentionally removed. Non-Bearer tenant resolution and candidate invite-token controller exceptions remain unchanged.
- Existing Organization.identify semantics (including alias/default resolution) are retained; this patch does not redesign organization canonicalization. Signature verification still precedes the new authorization check. Middleware decoding is only a hint until that verification/binding occurs.
- Local login still lets any admin choose a tenant; the login regression explicitly preserves this unresolved B1 behavior. No membership or token-issuance authorization model was invented.

## Change and rationale

1. `AuthorizeApiRequest#call`: after verified JWT decode, require a present string scheme resolving to the same organization as Current.organization; otherwise InvalidToken maps to HTTP 401. This binds authenticated context without trusting tenant hints as signed claims.
2. `TenantResolverMiddleware`: a case-insensitive Bearer header selects the JWT-only resolution path, even if decoding/scheme resolution produces no tenant. Header/Referer fallback is retained only for non-Bearer requests.
3. `PortfoliosController#regenerate`: comment now states the existing failure-recovery/no-re-roll policy; no behavior change.
4. `signed_tenant_contract_spec.rb`: acme own access; no-scheme/header denial; no-scheme/Referer denial; conflicting header does not override signed acme and globex record remains 404; a forced resolved-context mismatch returns 401; local login still issues caller-selected scheme. No production exploitation or real candidate data.

Trade-off: signed tokens without tenant are no longer accepted through HTTP hints. Existing issuer integration must be checked before deployment. The alternative of retaining fallback preserves ambiguity; redesigning login/membership exceeds this authorization. No claim of complete authentication security follows from these tests.

## Watched red, then green

Commands run with Ruby 3.3.2 on the local test DB; Gemini clients are stubbed.

- Before fix: `bundle exec rspec spec/requests/signed_tenant_contract_spec.rb spec/requests/tenant_isolation_spec.rb` -> **19 examples, 3 failures**, seed 41555. Scheme-less header/Referer requests and mismatched context returned 200 instead of 401.
- Strengthened before-fix checks also forbid Organization.identify from being called for missing-scheme Bearer requests -> **19 examples, 3 failures**, seed 50431. They demonstrate both fallback branches independently of the later auth check.
- After fix: same focused command -> **19 examples, 0 failures**, seed 61061; existing tenant-isolation controls remain green.

## Isolated patch versus full local working tree

To avoid attributing pre-existing changes to this commit, a temporary copy of `git archive 21bb9a1` was overlaid with only the three selected application files and this new request spec. It reused installed dependencies and ignored local API configuration for test access; no dependency upgrade or production provider call. Tests ran sequentially against the local test DB, not concurrently with the working-tree backend suite.

| Scope | Backend | Frontend | Type/build |
|---|---|---|---|
| Isolated bounded patch over 21bb9a1 | `bundle exec rspec`: **98 examples, 0 failures**, seed 32976 | `npm test`: **26 tests**, 15 portfolio + 11 outcome | `npx tsc --noEmit` and `VITE_DEV_TOKEN= npm run build` pass |
| Full current working tree, including previous uncommitted fixes | `bundle exec rspec`: **105 examples, 0 failures**, seed 26269 | `npm test`: **29 tests**, adds 3 previous auth/build-boundary tests | application `npx tsc --noEmit` and `npm run build` pass |

The isolated frontend had no copied local `.env`; the development-token variable was explicitly blank for its build. Neither row is a fresh-machine dependency-install proof. The previously disclosed separate Vite-config typecheck gap remains open; no Node-type/lockfile work was added. CI and Docker/cluster are not verified. Prior dump.rdb and package-lock.json remain untouched.

## Required report/PR wording

Tenant isolation is enforced for authenticated requests whose signed token names the tenant. Which tenants a user may obtain a token for is decided by the token issuer; the local login lets any admin pick a tenant (B1), so this is a release blocker for multi-tenant deployment, escalated.

## Re-scoring narration and unchanged limitations

If the AI re-scores in the background (a delayed retry or an admin re-run), your L4 survives and is flagged. Assessors can't re-roll a score; disagreement goes through an override.

Qualification: a newer eligible successful generation with a changed AI basis raises the changed-level review flag. An older delayed result is superseded. admin_rescore has no endpoint; the demo seeds that controlled state. The failed re-score scene concerns background/internal processing, not an assessor action.

The local PDF, PR draft, video storyboard and submission-blueprint authority/failure scenes were updated to this boundary. These artifacts remain outside the Git repository and unpublished; they are not silently added to this bounded commit.

Disclosed, not modified here: unexpected errors can leave generations running until recovery; normalized quote matching lacks word-boundary constraints; coverage confidence ignores evidence-check quality; fit/gap snapshots can become stale. These observations are not expanded into additional fixes.

Candidate-personal verification remains unconfirmed. No push, PR creation, deployment, video publication or submission is authorized by this patch.
