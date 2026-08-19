# Phase 5 — Backend changes, explained for a frontend dev

The biggest phase so far. It does two mostly-independent things: (1) installs file storage so the app can persist an uploaded CV, and (2) builds the data model + CRUD API for "CV screening" — a recruiter uploads a batch of CVs against a vacancy, and each one becomes a row that eventually gets a decision (invited / rejected / needs a human). The actual *decisioning* (reading the PDF, detecting an email, scoring against the vacancy) is Phase 6 — this phase only builds the shape everything else will plug into.

## Part 1 — File storage (ActiveStorage + Cloudflare R2)

**What ActiveStorage is:** Rails' built-in file-upload/attachment system. Think of it as the built-in equivalent of wiring up `multer` + an S3 client + a join table yourself — Rails ships the whole thing, you just point it at a storage backend. It wasn't installed in this repo at all before this phase (no config, no tables) — this project genuinely never had file uploads.

**Why R2 and not local disk in production:** Kubernetes pods here are stateless and don't share a disk — the app's own `k8s/` manifests define zero volumes. A file saved to one pod's local disk is invisible to every other pod (including the Sidekiq worker pod that will process it in Phase 6). R2 is Cloudflare's S3-compatible object storage — "S3-compatible" means it speaks the same API as AWS S3, so the same `aws-sdk-s3` gem talks to either one, just pointed at a different `endpoint`. Locally, in dev/test, files go to plain local disk instead (`config/storage.yml`'s `test`/`local` services) — no R2 credentials needed to run this app on your machine.

**The one landmine, hand-fixed:** Rails generates the ActiveStorage tables via `bin/rails active_storage:install`. This app has `config.generators primary_key_type: :uuid` set globally (a leftover setting nothing else in the app actually uses — every real table here has a plain auto-incrementing integer, "bigint," primary key). Left alone, the generator would have made `active_storage_attachments.record_id` — the column that says *which* CV screening entry a file belongs to — a `uuid`, while `cv_screening_entries.id` (below) is a bigint. Two different column types can't be joined together in SQL. The generated migration was hand-edited to force just that one column back to bigint; every other new table's own `id` column stays uuid, which is fine since nothing joins to those directly.

```ruby
t.references :record, null: false, polymorphic: true, index: false, type: :bigint
```

`config/storage.yml` defines the actual services (`test`, `local` = disk; `r2` = the real S3-compatible one), and each environment's config file (`development.rb`/`test.rb`/`production.rb`) picks which one to use.

## Part 2 — The CV screening data model

Three new tables, each modeled as its own ActiveRecord class in `app/models/`:

- **`CvScreening`** — the top-level "project": a name, which vacancy, which assessment, and an optional score threshold. This is what a recruiter creates once and reuses.
- **`CvScreeningBatch`** — one row per upload event. The important design detail: it **snapshots** `vacancy_id`, `assessment_id`, `vacancy_version_id` (from Phase 2's frozen versions), and `threshold` at the moment of upload. If the vacancy gets edited *after* a batch was uploaded, that batch keeps scoring against what the vacancy looked like when it was uploaded — same "immutable snapshot" idea as Phases 2-4, applied here to a whole upload event instead of a single record.
- **`CvScreeningEntry`** — one row per uploaded file within a batch. Carries a `decision` (`pending` / `needs_review` / `invited` / `not_advanced`) and the actual attached file (`has_one_attached :cv_file` — the ActiveStorage relationship from Part 1). `detected_email` is indexed so a future phase can detect the same candidate showing up across two different batches.

**A real design decision worth knowing:** all three tables carry their own `tenant_id` and `include TenantScoped` (the multi-tenant safety mechanism from earlier phases — see `phase-1-backend.md`'s concept table). Two of this phase's API routes (`.../review`, `.../file`) look up a `CvScreeningEntry` directly by its own id, with no screening id in the URL at all — so tenant isolation can't rely on "always reached through a tenant-scoped parent." Giving every table its own `tenant_id` makes a plain `CvScreeningEntry.find(id)` automatically return nothing for another tenant's row, everywhere, without any controller having to remember to check.

**`decision` is a real Postgres enum**, not just a string — the same pattern Session's `status` uses (see `db/migrate/20260818100003_create_cv_screening_entries.rb`'s `create_enum`). Postgres itself refuses to store a value outside `pending | needs_review | invited | not_advanced`, on top of Rails' own validation.

## The API — three controllers, matching three RESTful-ish resources

- **`CvScreeningsController`** — `index`/`create`/`show`/`update`. `show` also returns summary counts (how many entries are `pending`/`needs_review`/`invited`/`not_advanced`) computed with one grouped SQL query (`group(:decision).count`), not by loading every entry into Ruby.
- **`CvScreeningBatchesController`** — one action, `create`, nested under a screening (`POST /cv_screenings/:cv_screening_id/batches`). Accepts multipart file uploads (`params[:files]`, an array — this is the first file-upload endpoint in this codebase, so that param shape is this feature's own invention, not an existing convention). Creates the batch (snapshotting as described above) and one entry per file, attaching each.
- **`CvScreeningEntriesController`** — `index` (nested, listable/filterable by `decision`), plus `review` and `file` as direct-by-id actions. `review` is where a recruiter manually resolves a `needs_review` entry:
  ```ruby
  case request_body[:action]
  when 'invite'  then @entry.update!(decision: 'invited', decision_reason: 'recruiter_invited')
  when 'reject'  then @entry.update!(decision: 'not_advanced', decision_reason: 'recruiter_rejected')
  end
  ```
  Notice `request_body[:action]`, not `params[:action]` — `params[:action]` is a *reserved* Rails routing key that always holds the controller action's own name (`"review"` here, always), regardless of what the client sent in the request body. Reading the client's intended `invite`/`reject` value has to go through `request_body` (an existing helper in `ApplicationController` that reads only the parsed request body, bypassing routing params) instead. This is a real gotcha the original design's own route spec (`{action: 'invite'|'reject'}`) walks straight into if you're not paying attention to Rails' reserved param names.

**`file`** streams the attached file back through the API rather than exposing a direct R2 URL — the bucket is private on purpose, and `needs_review` is exactly the case where a human needs to actually look at the original file. It follows the same `send_data` pattern the existing portfolio PDF export already uses.

**Nothing enqueues a background worker yet.** The original plan described the batch-upload endpoint as "enqueues workers," but that worker (`CvScreeningProcessEntryWorker`) is Phase 6 — referencing a class that doesn't exist yet would crash the endpoint immediately (Ruby raises `NameError` the instant you reference an undefined constant, unlike, say, an unused database column sitting there harmlessly). Entries are created and just sit at `decision: 'pending'` until Phase 6 adds the actual enqueue call into this same action.

## Two security fixes bundled into this phase

- **`config/initializers/filter_parameter_logging.rb`** (new) — tells Rails to redact any param whose name matches `passw`, `email`, `token`, `secret`, `cv`, `file`, `resume` before writing it to the log. This wasn't just for CV uploads: before this file existed, `config.filter_parameters` was empty, meaning `POST /api/v1/auth/login` was logging plaintext passwords on every request — a pre-existing bug this phase happens to fix as a byproduct of needing the same protection for CV data.
- **Upload throttle** in `config/initializers/rack_attack.rb` — 10 uploads per minute per IP, same rate-limiting mechanism the login endpoint already used.

## A real gap this phase found and fixed: Rack::Attack was never actually neutralized in tests

Phase 1's own plan called for disabling Rack::Attack (the rate-limiter above) during test runs — otherwise every request spec depends on a real Redis connection and risks tripping a throttle limit by accident from rapid-fire test requests. That setup was described but never actually built, because Phase 1 through 4 never wrote a single request spec, so the gap was invisible. Phase 5 is the first phase with real HTTP-level specs, so it surfaced immediately. Fixed with `spec/support/rack_attack.rb` (swaps in an in-memory cache, disables the rate limiter by default) — and then used deliberately to write one spec that re-enables it just long enough to prove the new upload throttle's 429 response is real, not just configured and untested.

## Specs

Three request-spec files (a new kind of spec for this app — `type: :request`, meaning "make a real HTTP call through the whole middleware stack and check the response," as opposed to a model/service spec that calls Ruby methods directly): tenant isolation (a recruiter in one org can't see another org's screening, entry, or file), the public-requirement-text validation blocking screening creation, batch/entry creation with a real file attachment, the manual review action, and the upload throttle.

One test-setup bug worth knowing about, since it produced a genuinely confusing error the first time: `create(:cv_screening, tenant_id: some_org.id)` looks like it should be enough to pin a screening to a tenant, but the factory's `vacancy`/`assessment` build under their *own* default organization unless you also override that — so the screening's `tenant_id` and its `vacancy.tenant_id` silently pointed at two different organizations. The fix was `create(:cv_screening, organization: some_org)` instead, which derives `tenant_id` and both associations from the same transient value.

## Running it yourself

```bash
cd api
bundle exec rails db:migrate
bundle exec rspec
bundle exec rails zeitwerk:check
```
