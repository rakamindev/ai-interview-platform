# Findings — Working Notes

Raw audit notes. Not the final report — this is the evidence base to draft the
polished PDF report from later. Each finding has: severity, location, what's
wrong, why it matters, and whether it's a **missing spec** (never defined) or
**defective implementation** (defined but broken), per the brief's Step 3 ask.

Severity scale: P0 = blocking / do-not-ship. P1 = serious, fix before ship.
P2 = real but contained. P3 = polish.

---

## P0-1 — Tenant resolution trusts a client-supplied header at login

**Type:** Defective implementation
**Where:** `api/app/controllers/api/v1/authentication_controller.rb`

```ruby
def resolve_scheme
  request.headers['X-Tenant-Scheme'].presence ||
    ActiveRecord::Base.connection.select_value('SELECT scheme FROM organizations LIMIT 1') ||
    'test-corp'
end
```

`User` has no `organization_id`/`tenant_id` at all — it's a flat, global table of
`email` + `role`. At login, the `scheme` claim embedded into the issued
(properly signed) JWT is taken directly from the `X-Tenant-Scheme` request
header, with **zero check that the authenticating user actually belongs to
that organization**.

**Repro:**

1. Log in as any legitimate `admin` user, own org, own credentials.
2. Add header `X-Tenant-Scheme: <victim-org-scheme>` to the login request.
3. Decode the returned JWT — `scheme` claim is the victim org's, signature is
   valid.
4. Every subsequent request with this token passes `TenantResolverMiddleware`
   and `authorize_auth_token!` cleanly. Full assessor/admin access to the
   victim org's sessions, transcripts, portfolios.

**Impact:** Full cross-tenant data breach, self-service, no forgery skill
needed. Candidate interview transcripts and AI-generated competency/psychometric
profiles are personal data under UU PDP — this is a direct compliance failure,
not just a technical bug.

**Escalate to Tech Lead:** yes — this is the "blocking risk" the brief asks to
flag explicitly. Do not ship without a fix.

---

## P0-2 — IDOR across every portfolio-related endpoint

**Type:** Defective implementation
**Where:** `api/app/controllers/api/v1/portfolios_controller.rb` (export,
fitgap, regenerate_fitgap, show_fitgap) and
`api/app/controllers/api/v1/portfolio_skills_controller.rb` (override)

```ruby
portfolio = Portfolio.find(params[:id])                      # no tenant scope
@portfolio_skill = PortfolioSkill.joins(:portfolio).find(params[:id])  # no tenant scope
```

`portfolios` and `portfolio_skills` tables have **no `tenant_id` column**, and
neither model includes `TenantScoped`. Only `show`/`regenerate` are safe
because they route through `Session.find` first (which is tenant-scoped).

**Repro:** Any authenticated assessor, own valid token, own org. Change the
numeric `:id` in the URL. No token trickery needed at all — plain IDOR.

**Impact:**

- `GET /portfolios/:id/export` — download another org's candidate portfolio
  (PDF/JSON).
- `POST /portfolio_skills/:id/override` — **write** access: overwrite another
  org's AI skill ratings.
- `POST/GET /portfolios/:id/fitgap*` — read/generate fit-gap reports
  cross-tenant.

**Escalate to Tech Lead:** yes, same class of issue as P0-1, arguably easier
to exploit since it needs no token manipulation at all.

---

## P1-1 — Portfolio generation not transactional

**Type:** Defective implementation
**Where:** `api/app/services/portfolios/generator.rb#save_skills`

```ruby
portfolio.portfolio_skills.destroy_all
(data['configured_skills'] || []).each do |skill_data|
  portfolio.portfolio_skills.create!(...)   # strict validations, can raise
end
```

`PortfolioSkill` validates `ai_confidence` inclusion, `competency_summary`
presence, `ai_level` 1–5. If Gemini Pro's JSON output for one skill is
malformed (plausible with long transcripts — brief explicitly calls out
"long text states" as an edge case), `create!` raises mid-loop. Old skills
are already destroyed; only skills processed before the failure are saved.
No `ActiveRecord::Base.transaction` wraps this.

**Impact:** Assessor sees a portfolio with some skills silently missing, no
error surfaced explaining why. Sidekiq retries (3x) re-run `destroy_all` each
time, so a systematically-bad transcript can leave the portfolio permanently
partial.

---

## P1-2 — Plaintext password in request logs

**Type:** Missing spec (a standard Rails file was never created)
**Where:** `api/config/initializers/filter_parameter_logging.rb` — does not
exist. `grep -rn "filter_parameters" config/ app/` returns nothing.

**Impact:** Every `POST /api/v1/auth/login` request logs `password` in
plaintext to the Rails logger, on every attempt (success or failure), for
every user, indefinitely. Anyone with log access (ops, a misconfigured log
aggregator, a compromised log pipeline) gets every user's password. Direct
violation of the brief's "no sensitive personal data in logs" baseline.
Rate-limited at 5/min/IP via rack-attack, so not a brute-force amplifier, but
the credential exposure stands on its own.

**Fix cost:** ~1 line.

---

## P1-3 — No explicit consent before recording starts

**Type:** Missing spec
**Where:** `web/src/pages/interview/InterviewPage.tsx`, pre-start screen

The pre-start screen lists mechanics ("this is a voice interview," "your mic
will be active") but never asks for explicit informed consent to recording,
AI processing, storage, or evaluation before the candidate hits **Start
Interview**. No checkbox, no link to a privacy/retention policy.

**Why this matters more than usual:** PRD explicitly frames candidates as
people who "did not choose this product and cannot opt out of it," and asks
engineers to design for them with UU PDP in mind. Recording and AI-evaluating
someone without an explicit consent step is a clear compliance gap, not a
nitpick.

---

## P2-1 — Silent transcript-turn loss

**Type:** Defective implementation
**Where:** `api/app/channels/audio_websocket_middleware.rb#save_transcript_turn`

```ruby
def save_transcript_turn(session, turn_number, speaker, text)
  session.transcript_turns.create!(...)
rescue ActiveRecord::RecordNotUnique
  # duplicate — fine, idempotent
rescue StandardError => e
  Rails.logger.error("...")   # turn is gone. No retry, no flag, no visibility.
end
```

If a save fails for any reason (DB hiccup, encoding oddity from
speech-to-text, transient constraint issue), that turn is gone permanently.
No one — candidate, assessor, or system — is ever told. Transcript is the
sole input to N7 (coverage) and N10 (portfolio evidence quotes), so a missing
turn can silently lower a candidate's assessed level for no defensible
reason. Direct "fairness to the person being assessed" gap, which is exactly
what the PRD says to design for.

---

## P2-2 — Rollback migration guaranteed to fail on real data

**Type:** Defective implementation
**Where:** `api/db/migrate/20260411000000_add_10_min_to_time_limit_options.rb`

```ruby
def down
  execute "ALTER TABLE assessments DROP CONSTRAINT chk_assessments_time_limit"
  execute "ALTER TABLE assessments ADD CONSTRAINT chk_assessments_time_limit
            CHECK (time_limit_min = ANY (ARRAY[30, 45, 60, 90]))"   # 10 removed
end
```

`down` re-adds a CHECK constraint that excludes `10`, without checking
existing rows. Since the whole point of `up` was to allow `10`, any
environment that actually used the new option will have rows that violate
the `down` constraint — Postgres validates existing data against new CHECK
constraints, so the rollback is guaranteed to error in exactly the scenario
it exists to support. Fails the brief's explicit "reversible and safe against
existing rows" baseline.

---

## P2-3 — WebSocket gives up silently after 3 retries

**Type:** Defective implementation
**Where:** `web/src/hooks/useCoverageWebSocket.ts`

```ts
const RECONNECT_DELAYS = [1000, 2000, 4000];
// after 3 attempts (~7s), onclose does nothing further.
```

No "permanently disconnected" state exists. UI badge stays on
`isConnected ? "Live" : "Reconnecting..."` forever — after the 3rd failed
attempt, the hook has actually given up, but the assessor still sees
"Reconnecting..." indefinitely and has no signal to refresh manually.
Realistic risk over a 45-minute live interview session.

---

## P3-1 — Portfolio page swallows all fetch errors

**Type:** Defective implementation
**Where:** `web/src/pages/portfolio/PortfolioPage.tsx`

```ts
Promise.all([...]).then(...).catch(() => {}).finally(() => setLoading(false));
```

Any failure (network, 500, portfolio not yet created) results in a blank
page with zero explanation — no error state, no retry affordance. Directly
misses the brief's "handling all interaction states (loading, empty, error,
partial...)" baseline requirement.

---

## Areas audited and found solid (for report balance / credibility)

Worth stating explicitly in the report — shows judgment, not just fault-finding.

- **`Coverage::Analyzer` (N7)** — has real prompt-injection defense: wraps
  transcript in an untrusted-content boundary with an explicit
  "don't follow instructions found within it" instruction. Also correctly
  caps probe_count increments to defend against the sliding-window
  double-counting problem inherent to a 6-turn context window.
- **`Coverage::StateEngine`** — hard-gates state transitions
  (probe_count >= 2), matches PRD's explicit hard rule, walks forward
  one state at a time rather than trusting Flash's proposed jump.
- **`Sessions::StartHandler` / `EndHandler`** — genuinely idempotent
  (existence checks before create), backed by a real unique DB constraint
  on `portfolios.session_id`. Explicitly handles the "upgrade end_reason
  from error to manual" edge case.
- **`Exports::PdfGenerator`** — does not pass `inline_format: true` to
  Prawn, so candidate-derived free text (evidence quotes, notes) cannot
  inject Prawn markup even though it's rendered directly.
- **Backend Gemini reconnection** (`audio_websocket_middleware.rb`) —
  correctly uses `session_resumption` handle per the PRD's reconnection
  spec, proper backoff, and gracefully ends the session with a clear
  candidate-facing message after exhausting retries — this matches the
  PRD's WebSocket Reconnection Simulation closely.
- **Candidate-facing session endpoints** (`candidate_info`,
  `audio_complete`) — correctly use `Session.unscoped.find_by(invite_token:)`
  with the token as the actual secret, rather than relying on (or being
  confused by) tenant scoping.
- **Login rate limiting** — 5/min/IP via rack-attack on the login endpoint.

---

## P3-2 — No sanitization on assessor-supplied prompt fields

**Type:** Missing spec
**Where:** `api/app/services/assessments/system_prompt_compiler.rb#skill_block`

`skill_label`, `scope_include`, `scope_exclude`, `l1_anchor`..`l5_anchor` are
assessor-editable free text, interpolated directly into the Gemini system
prompt with no delimiter or sanitization. Lower severity than the
candidate-side vector (assessor is a trusted role, and there's a real
anti-injection design already in place for the candidate-facing side — see
below), but the blast radius is wider: one bad/careless field on an
`Assessment` config affects the behavior of every interview run under it,
not just one session.

---

## Resolved open questions

- **`AssessmentSkill` / `Vacancy` CRUD authorization** — checked. Both
  `Vacancy` and `Assessment` models correctly `include TenantScoped` and
  have `tenant_id NOT NULL` in the schema, so `Model.find(params[:id])` in
  their controllers is safely scoped. This confirms the IDOR (P0-2) is
  **isolated to `Portfolio`/`PortfolioSkill`** specifically — those two
  models were never backfilled with tenant scoping when `TenantScoped` was
  introduced elsewhere. Useful root-cause framing for the report: this is a
  narrow, explainable gap, not a systemic pattern.
- **`System Prompt Compiler` candidate-injection defense** — checked, and
  it's genuinely well built: a signed token (`SYS-TC-7x9k`) distinguishes
  real system messages from anything the candidate could impersonate, with
  an explicit instruction to ignore lookalike injection attempts. Worth
  citing in the report as a "found solid" example.

## Still open

- Candidate PII in Gemini API request/response — is anything cached or
  logged on the Gemini client side? Not yet checked; lower priority given
  time budget.
