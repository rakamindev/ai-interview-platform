# Phase 7 — Backend changes, explained for a frontend dev

This phase makes the pipeline from Phase 6 actually reach a candidate's inbox. Read [`phase-6-backend.md`](./phase-6-backend.md) first — this phase sends the emails that phase's decisions were building toward.

## ActionMailer — installed from scratch

Same story as ActiveStorage in Phase 5: this Rails feature (built-in email sending) wasn't installed in this app at all. One line in `config/application.rb` (`require 'action_mailer/railtie'`), and — since this is an API-only app with no `app/views` directory anywhere — every template had to be hand-written rather than generated:

```
app/mailers/cv_screening_mailer.rb
app/views/layouts/mailer.html.erb / mailer.text.erb
app/views/cv_screening_mailer/invited.html.erb / .text.erb
app/views/cv_screening_mailer/not_advanced.html.erb / .text.erb
```

Every email ships **both** an HTML and a plain-text version. This isn't just polish: a missing layout file makes Rails *raise*, not silently skip it, and shipping only HTML measurably hurts deliverability (spam filters treat text-only-missing as a signal).

## Where the actual send happens — and where it deliberately doesn't

`CvScreeningMailer` itself never gets called from inside `DecisionEngine` (Phase 6). Two separate call sites decide when to actually fire an email:

1. **`CvScreeningProcessEntryWorker`** (the automated background job) — calls a new service, `CvScreenings::BatchNotifier`, right after `DecisionEngine` finishes.
2. **`CvScreeningEntriesController#review`** (a recruiter manually resolving a `needs_review` entry) — sends immediately, no gate.

The reason these aren't the same code path is FR5, explained next.

## FR5 — the "mass-batch confirm gate" (implemented here, removed in Phase 20)

The requirement, in the original plan doc's own words: *"a batch that resolves entirely one way at either layer requires a confirm-before-firing step."* In plain terms: if a recruiter uploads 50 CVs and the automated pipeline decides to reject **all 50 of them**, that's very likely a sign something's misconfigured (a threshold set too high, an overly strict public-requirements gate) — not that 50 candidates in a row were genuinely all a poor fit. Firing 50 rejection emails automatically in that situation was judged the wrong default, so this phase built a hold-for-confirmation gate: a `CvScreeningBatch#notification_status` (`pending` → `held` or `released`), a batch whose auto-decided entries all landed the same way got held instead of released, and a `POST /cv_screenings/:id/batches/:id/confirm` endpoint let a recruiter explicitly release it.

**This mechanism no longer exists.** Phase 20 removed it entirely, per direct product request — auto-invite/auto-reject now always send immediately, with no confirmation step. See [`phase-20-backend.md`](./phase-20-backend.md) for the removal itself and, notably, a real bug this gate's logic had been silently causing (a batch could get permanently stuck never notifying anyone at all, discovered live in this same session before the removal decision was made). `notification_status` and `'held'` still exist in the schema/enum only so a row from before this change stays valid — nothing in the app can produce a new `'held'` batch anymore.

**A single recruiter manually clicking "reject" on one entry never went through this gate at all**, and still doesn't — they already made a direct, deliberate decision about that one candidate; the "did the automated pipeline go systematically wrong" risk this gate existed for doesn't apply to a human's individual judgment call. That distinction is why `CvScreeningEntriesController#review` and the automated worker path still call different `BatchNotifier` methods (`.send_now!` directly vs. `#evaluate_after_entry_decision`) even after the gate's removal — see Phase 20's doc for what `#evaluate_after_entry_decision` does now.

## A gap this phase had to go back and fix in Phase 6

The invite email needs a link to the actual interview (`session.invite_url`). But Phase 6 deliberately decided **not** to link a `CvScreeningEntry` back to the `Session` its `Inviter` service creates — reasoning at the time: nothing needed that link yet, and it could wait for Phase 8's UI work. That held up until this exact moment: without some way to get from "this entry got invited" back to "which session did that create," there's no way to build the email at all. Fixed by adding `cv_screening_entries.session_id`, set by `Inviter` itself right after it creates the session — which incidentally means Phase 8 no longer has to add this column itself, since it now already exists.

## The kill switch — `MAIL_ENABLED`

The plan doc is explicit about why this matters: *"Shipping a feature that auto-emails rejected candidates with no kill switch is a compliance and reputational risk."* This app has no configured sending domain, SPF, or DKIM record anywhere — sending real email from it today would likely just land in spam, or worse, get the domain blocklisted.

Rather than sprinkling `if ENV['MAIL_ENABLED']` checks through the worker and controller, the switch is wired into Rails' own delivery mechanism, once, in `config/environments/production.rb`:

```ruby
config.action_mailer.perform_deliveries = ENV.fetch('MAIL_ENABLED', 'false') == 'true'
```

When this is `false` (the default), **every** `.deliver_now` call anywhere in the app becomes a silent no-op automatically — Rails' own built-in behavior, not something this app had to build. Development uses the `:file` delivery method instead (built into Rails, writes each email to `tmp/mails/` as a plain file you can `cat` — no browser needed, which matters running this in Docker or over SSH). Test uses `:test` delivery, which just appends to an in-memory array (`ActionMailer::Base.deliveries`) that specs can inspect directly.

**Always `deliver_now`, never `deliver_later`.** This is the exact same trap already documented for Phase 4's `Sessions::Creator`: `deliver_later` would silently fall back to ActiveJob's in-process `:async` adapter unless very specific config is in place, meaning emails would just vanish on every pod restart with no error, no retry, no trace. There's a dedicated spec (`spec/mailers/no_deliver_later_spec.rb`) that scans every file under `app/` for an actual `.deliver_later` call and fails the build if it finds one — a "guard rail" spec, not testing behavior so much as testing that a specific mistake never creeps back in.

## Retention — simpler than the original plan expected, for a good reason

The plan doc's retention section describes nulling out an `extracted_text` column and scrubbing "verbatim CV excerpts" from stored LLM reasoning. Neither of those exists in this app's actual implementation: Phase 6 made a deliberate choice to never persist the extracted CV text or the AI's raw reasoning anywhere — `DecisionEngine` uses the text in one in-memory pass and throws it away, and the only AI-generated text that *is* stored (`feedback_text`) is built exclusively from the vacancy's public requirement text, never the candidate's own CV, so it can't contain anything PII-bearing by construction.

That leaves `CvScreenings::RetentionSweep` with a genuinely simple job: for any entry older than `CV_RETENTION_DAYS` (default 90), permanently delete the attached CV file and null out `detected_email` — the only two places CV-derived PII actually lives. Runs daily via `k8s/cronjob-retention.yaml` (a Kubernetes CronJob reusing the same container image as everything else, scheduled at 03:00), or manually via `bundle exec rake cv_screening:purge_expired`.

## Specs

`spec/mailers/cv_screening_mailer_spec.rb` asserts both email bodies contain no digit-percent/score/threshold language — not just "trust the prompt," an actual content check. `spec/services/cv_screenings/batch_notifier_spec.rb` covered the hold/release/mixed/confirm matrix as of this phase — see [`phase-20-backend.md`](./phase-20-backend.md) for how that spec (and the behavior it tests) changed once the confirm gate was removed. `spec/services/cv_screenings/retention_sweep_spec.rb` proves an expired entry gets purged and a fresh one doesn't. `spec/mailers/no_deliver_later_spec.rb` is the guard rail described above.

## Running it yourself

```bash
cd api
bundle exec rails db:migrate
bundle exec rspec
bundle exec rails zeitwerk:check
bundle exec rake cv_screening:purge_expired   # safe to run anytime — no-op if nothing's expired
```
