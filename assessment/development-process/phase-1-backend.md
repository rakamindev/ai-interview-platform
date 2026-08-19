# Phase 1 — Backend changes, explained for a frontend dev

You know React/React Native, npm, Jest/Vitest, and Prisma/Sequelize-style ORMs. This backend is **Ruby on Rails**, and its testing library is **RSpec**. Nothing here is conceptually new — it's the same ideas you already know, wearing different names. This doc translates.

## 1. Concept table — Rails/Ruby → something you already know

| Rails/Ruby term | What it actually is | Closest thing you know |
|---|---|---|
| **gem** | A Ruby library, published to a package registry (RubyGems) | An npm package |
| **Gemfile** / **Gemfile.lock** | Declares which gems + versions your app needs | `package.json` / `package-lock.json` |
| **`bundle install`** | Installs everything in the Gemfile | `npm install` |
| **RSpec** | The test framework — `describe`/`it`/`expect` | Jest or Vitest, almost 1:1 syntax |
| **ActiveRecord model** | A Ruby class backed by a database table, with validations, associations, queries | A Prisma/Sequelize model — the ORM layer |
| **migration** | A versioned, ordered script that changes the DB schema (add a table, add a column...) | A Prisma migration / Knex migration |
| **FactoryBot "factory"** | A declarative recipe for building test data | Like a `buildMockUser()` helper, but framework-managed instead of hand-rolled |
| **Sidekiq "worker"** | A class that processes background jobs off a queue (Redis-backed) | A queue consumer — think a BullMQ worker, not a request handler |
| **middleware** | Code that runs on every request before it reaches a controller | Express middleware / a fetch interceptor |
| **Zeitwerk (the autoloader)** | Rails' convention: a file at `app/models/foo_bar.rb` is expected to define a class `FooBar` — no explicit imports | Similar spirit to how Vite/webpack resolve a file to a module by path, except Rails does it for *class names*, automatically, everywhere |
| **`RequestStore.store` / `Current` / "tenant"** | Per-request global state — this app serves multiple customer organizations ("tenants") from one codebase, and `Current.tenant_id` tracks *which* org the current request belongs to | Closer to Node's `AsyncLocalStorage` than React Context — it's server-side, per-request, not per-component |

Keep this table open — every section below just says "this is basically X."

## 2. `api/Gemfile` — added `webmock`

```ruby
group :test do
  gem 'database_cleaner'
  gem 'timecop'
  gem 'webmock'   # ← new
end
```

This is exactly like adding a devDependency to `package.json`. WebMock's job: **block any real HTTP request made during a test.** If a test accidentally calls the real Gemini AI API (instead of a stubbed fake), WebMock throws an error immediately instead of letting the request go out — which matters a lot here, because that request would carry real candidate CV text and PII. It's a safety net sitting *underneath* the normal mocking (see `spec/support/gemini.rb` below), not the primary way tests fake API calls.

## 3. `api/.rspec` — the CLI config file

```
--require spec_helper
--color
--format documentation
```

This is RSpec's equivalent of a `jest.config.js` — flags that apply to every `rspec` run without having to type them each time. `--require spec_helper` auto-loads the base config file (§4) before any test runs. `--format documentation` is just cosmetic — it prints nested `describe`/`it` blocks as readable sentences instead of dots.

## 4. `spec_helper.rb` vs `rails_helper.rb` — why two files?

RSpec conventionally splits config into two files:

- **`spec/spec_helper.rb`** — RSpec settings only. No Rails loaded. Fast.
- **`spec/rails_helper.rb`** — boots the *entire* Rails app (`require_relative '../config/environment'`) so specs can use models, DB, routes, everything.

Why bother splitting them? Booting Rails is comparatively expensive. Keeping `spec_helper.rb` Rails-free means a hypothetical pure-Ruby unit test (no DB, no models) could load in milliseconds instead of paying Rails' full boot cost. In this app, nearly every spec will need Rails, so in practice you'll almost always see `require 'rails_helper'` at the top of a spec file — but the split is the RSpec-idiomatic default, so we kept it.

The interesting part of `rails_helper.rb` is this guard, which replaces a line RSpec normally generates automatically:

```ruby
unless ActiveRecord::Base.connection.schema_exists?('ai_interview')
  abort <<~MSG
    The `ai_interview` Postgres schema does not exist in the test database.
    Do NOT run `db:test:prepare` or `db:schema:load` ...
    Build the test database with: RAILS_ENV=test bin/rails db:create db:migrate
  MSG
end
```

**Why this exists:** all of this app's tables live inside a named Postgres schema called `ai_interview` (think of a Postgres "schema" as a folder that groups tables — like a namespace). The file Rails normally uses to snapshot-rebuild a test database (`db/schema.rb`) **doesn't capture that folder structure** — it only captures tables and columns, not the `CREATE SCHEMA ai_interview` statement, which lives only inside the very first migration file. If you let Rails use its normal fast-rebuild trick, it would silently recreate every table in the *wrong* place (the default `public` schema) and report success — no error, just a database that looks empty to the actual app. This guard makes that failure loud and instructive instead of a silent, confusing mess three files later.

## 5. `config/environments/test.rb` — one line added

```ruby
config.active_record.dump_schema_after_migration = false
```

Every time you run a migration, Rails' default behavior is to re-dump `db/schema.rb` as a fresh snapshot. Since that snapshot file is already missing the schema-folder detail (§4), letting a test run silently rewrite it would make the problem worse, not better. This line just turns that auto-rewrite off in the test environment.

## 6. `spec/support/*.rb` — one recurring test problem, solved once, reused everywhere

Each file here is loaded automatically by `rails_helper.rb` and configures one thing that *every* spec in the app would otherwise need to remember to do by hand. Think of these like a shared Jest `setupFilesAfterEach` — except split by concern instead of dumped in one file.

- **`database_cleaner.rb`** — wraps every test in a database transaction, then rolls it back at the end. Same problem Jest's `beforeEach`/mocked DB layer solves for you: tests shouldn't leave junk rows behind for the next test to trip over.
- **`tenant.rb`** — clears `Current`/`RequestStore` (the per-request tenant state from the concept table) before *and* after every test. Why both? Because a background worker in production always starts with that state empty — and a test that forgets to clean up after itself would otherwise leak tenant data into the *next* test, silently filtering its queries. Also defines a helper:
  ```ruby
  with_tenant(organization) { expect(Assessment.count).to eq(1) }
  ```
- **`auth.rb`** — builds a fake login (a signed JWT) for request-level tests, the same way you'd fabricate an auth header in an API test with supertest/msw:
  ```ruby
  auth_headers(user_id: 1, role: 'assessor', scheme: org.scheme)
  # => { 'Authorization' => 'Bearer <token>', 'X-Tenant-Scheme' => org.scheme }
  ```
- **`sidekiq.rb`** — background jobs (§1) default to "fake" mode during tests: calling `SomeWorker.perform_async` just records that it *would* run, without actually running it. This file resets that record before each test.
- **`gemini.rb`** — the primary AI-call fake, mentioned in §2. Provides `stub_gemini_client(response)`, an `instance_double` (RSpec's verified-double — like a Jest mock, but one that also checks the method signature actually exists on the real class) standing in for the real Gemini HTTP client.
- **`webmock.rb`** — one line: `WebMock.disable_net_connect!(allow_localhost: true)`. The network killswitch backing up `gemini.rb`.

One more support file worth a one-liner: **`factory_bot.rb`** just registers `FactoryBot::Syntax::Methods` so every spec can call `create(:x)` / `build(:x)` directly instead of the more verbose `FactoryBot.create(:x)`. It's redundant with a line already in `rails_helper.rb` — kept as its own file purely to match the "one file per concern" convention the rest of `spec/support/` follows.

## 7. `spec/factories/*.rb` — declarative test-data builders

If you've only built mock data by hand (`{ id: 1, name: 'Test' }`) or with MSW handlers, a FactoryBot factory is the declarative version of that:

```ruby
FactoryBot.define do
  factory :assessment do
    transient do
      organization { create(:organization) }
    end

    tenant_id { organization.id }
    created_by { 1 }
    sequence(:name) { |n| "Assessment #{n}" }
    time_limit_min { 30 }
    language { 'en' }
  end
end
```

Then anywhere in a test: `create(:assessment)` inserts a real, valid row into the test DB; `build(:assessment)` builds the Ruby object without saving it (like `create` vs. a plain object literal). `sequence(:name) { |n| ... }` guarantees uniqueness across calls (`"Assessment 1"`, `"Assessment 2"`, ...) — the FactoryBot equivalent of `faker`-style random/unique test data.

Every factory sets `tenant_id` explicitly. This is required, not stylistic: `Current.tenant_id` (§1) is empty by default inside a test (see `tenant.rb` above), so the model can't infer which tenant it belongs to on its own — you have to say so.

## 8. `spec/models/organization_spec.rb` — the one actual test

Everything above is scaffolding. This is the only file that actually runs assertions:

```ruby
require 'rails_helper'

RSpec.describe Organization, type: :model do
  it 'is valid from the factory' do
    organization = build(:organization)
    expect(organization).to be_valid
  end

  it 'is findable by scheme via .identify' do
    organization = create(:organization)
    expect(Organization.identify(organization.scheme)).to eq(organization)
  end
end
```

Read this exactly like a Jest test: `describe` groups related tests, `it` is one test case, `expect(...).to be_valid` / `.to eq(...)` are matchers. This is the template every future spec file in Phases 2–9 will follow.

## 9. Bonus: `config/initializers/inflections.rb` — a bug this work uncovered

Not planned work — a pre-existing bug this session's testing turned up. `app/channels/audio_websocket_middleware.rb` defines a class `AudioWebSocketMiddleware` (capital S), but Zeitwerk (§1's autoloader) expects a file named `audio_websocket_middleware.rb` to define `AudioWebsocketMiddleware` (lowercase s) — its default naming rule doesn't know "WebSocket" is meant to be treated as one capitalized unit. This was never caught before because Rails only strictly enforces that naming rule when *eager loading* (loading every file up front, as production does) — and nothing in this repo had ever triggered eager loading before this session added a CI-style check for it. The fix is one Rails-standard line telling the autoloader about the exception:

```ruby
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym 'WebSocket'
end
```

One housekeeping fix, not conceptually interesting: `api/bin/{rails,bundle,rake}` had lost their executable permission bit at some point (likely a zip/export artifact) — `chmod +x` restored it. No content changed in those files, just a file-permission flag, same idea as `chmod +x` on a shell script anywhere else.

## 10. Running it yourself

```bash
cd api
bundle install
RAILS_ENV=test bin/rails db:create db:migrate   # build the test DB (see §4 — never db:test:prepare)
bundle exec rspec                                # run all specs
bundle exec rails zeitwerk:check                 # confirm the autoloader is happy
```
