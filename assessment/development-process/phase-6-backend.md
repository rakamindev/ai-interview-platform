# Phase 6 — Backend changes, explained for a frontend dev

The biggest phase in the whole build. This is where an uploaded CV actually gets read, checked, scored, and turned into a decision. Read [`phase-5-backend.md`](./phase-5-backend.md) first if you haven't — this phase is the pipeline that finally acts on the data model that phase built.

## The shape of the pipeline

One entry (one uploaded CV) goes through five steps, in order, each of which can stop the pipeline early:

```
extract text → detect email → Layer 1: public gate → Layer 2: private score → compare to threshold
```

Every one of those five steps can fail in its own way, and the entire point of this phase — called out explicitly in the plan doc as an invariant — is: **no failure, anywhere in this chain, is ever allowed to look like a rejection.** Only one thing can produce an automated `not_advanced`: the AI model giving a genuine "no" answer at Layer 1. A timeout, a malformed response, a missing email, an unreadable PDF — every one of those routes to `needs_review`, where a human decides. This shows up in the code as a very deliberate `status: :ok | :model_failed` (or `:passed | :failed | :model_failed`) split on almost every service's return value — "the check ran and said no" and "the check itself broke" are never allowed to collapse into the same code path.

## The services — `app/services/cv_screenings/`

(Plural — see the "one bug I found" section below for why it's not `cv_screening/`.)

- **`TextExtractor`** — turns an uploaded file into plain text. PDFs go through the `pdf-reader` gem; DOCX files go through `rubyzip` (to open the file, which is secretly just a zip archive) + `nokogiri` (to parse the `word/document.xml` file inside it, which is where Word actually stores the text). The critical detail: it identifies the file type by **sniffing the actual bytes** (via the `marcel` gem, the same library browsers/OS file pickers use for this), never by trusting the `.pdf`/`.docx` extension the uploader gave it. A PNG renamed to `resume.pdf` gets correctly identified as an image and rejected, not fed to a PDF parser that would choke on it. This method is designed to **never raise** — every possible parsing exception is caught and turned into a structured "here's what went wrong" result instead, because one bad upload in a batch of 50 must not blow up the other 49.
- **`EmailDetector`** — finds the candidate's own email in the extracted text, preferring whatever's near the top of the document (a header/contact block) over anything found further down (which is more likely a reference's email). If it finds more than one plausible email and can't tell which is the candidate's, it deliberately returns nothing rather than guessing — guessing wrong here means emailing a stranger about someone else's application, a real privacy problem, not just a minor bug.
- **`PublicGateChecker`** (Layer 1) — a Gemini call that checks the CV against *only* the vacancy's public requirement text (the plain-language blurb a candidate would see, not the recruiter's private scoring criteria). Cheap and coarse on purpose: it runs first so a CV that's obviously wrong for the role never burns a second, more expensive Gemini call.
- **`Matcher`** (Layer 2) — only runs if Layer 1 passed. A more detailed Gemini call against the vacancy's *private* fields (skills, culture, competency expectations, all pulled from the frozen `VacancyVersion` from Phase 2 — so editing the vacancy after a batch was uploaded can't retroactively change what that batch is scored against). Returns a 0-100 score.
- **`FeedbackGenerator`** — writes the message a rejected candidate actually receives. Its constructor takes **exactly one piece of information**: the vacancy's public requirement text. Not the score, not the threshold, not the private criteria — those parameters don't exist on this class at all, so there's no way for that information to leak into a candidate email by accident, no matter how the surrounding code changes later. (There's a spec that asserts this directly, by inspecting the method signature itself, not just by testing behavior — see the specs section.)
- **`Inviter`** — a thin wrapper that calls `Sessions::Creator` (built back in Phase 4) to actually create the interview session. No invite logic is duplicated here; this class exists so both the automated pipeline and a recruiter's manual "invite" button (see below) go through the exact same path.
- **`DecisionEngine`** — the conductor. Runs the five steps above in order and writes the final `decision`/`decision_reason` onto the entry. This is where the actual qualifying check lives:
  ```ruby
  if threshold.present? && match.score >= threshold
    Inviter.new(entry: @entry).call
    finish('invited', 'auto_invited', extraction.char_count)
  else
    finish('needs_review', 'below_private_threshold', extraction.char_count)
  end
  ```
  That `>=` is doing real work: a candidate who scores *exactly* at the threshold should qualify, not narrowly miss out. Phase 9 (later) will deliberately break this one line (flip it to `>`) and revert it, as a demonstration that the test suite actually catches a change like that — which is exactly why `decision_engine_spec.rb` has a dedicated test asserting `score == threshold` results in `invited`.

## The worker — `app/workers/cv_screening_process_entry_worker.rb`

A Sidekiq background job, one per uploaded file. Two things worth knowing if you haven't touched a background job before:

- **It only ever receives an entry's id**, never the CV text, the email, or the filename. Sidekiq keeps a log of every job's arguments (visible in its retry/dead-job dashboard) — passing PII there would mean personal data sitting in infrastructure logs indefinitely.
- **It's idempotent** — `return unless entry.pending?` at the very top means if Sidekiq ever runs this job twice (which does happen — retries, redeploys), the second run is a complete no-op for any entry that already got a decision. No double-inviting, no double-emailing.

`CvScreeningBatchesController#create` (Phase 5) now actually enqueues this job for each uploaded file — that's the one line Phase 5 deliberately left as a comment-marked gap, since the worker didn't exist yet.

## The manual-review path also got wired up

Phase 5 built `POST /cv_screening_entries/:id/review` but left its `invite`/`reject` branches as placeholder decision-updates with comments marking where this phase would hook in. Now they actually call `Inviter`/`FeedbackGenerator` — a recruiter manually resolving a `needs_review` entry goes through the identical services the automated pipeline uses, not a separate copy of the same logic.

## Two real bugs this phase's specs caught immediately

Worth knowing about, since they're the kind of thing that would otherwise ship silently:

1. **`URI::MailTo::EMAIL_REGEXP` doesn't do what its name suggests for this use case.** It's *anchored* (`\A...\z` in regex terms — "the entire string, start to finish, must be exactly this"), which is exactly right for validating a signup form field ("is this whole string an email?" — how `User`'s own validator already uses it elsewhere in this app) but useless for finding an email-shaped substring buried inside a page of CV text. `EmailDetector`'s first draft used it and matched nothing, ever — caught the moment its own spec ran, fixed with a plain unanchored pattern.
2. **A DOCX extraction silently returned the wrong object.** `Zip::File.open_buffer(bytes) { ... }`'s own return value isn't reliably whatever the block returns — it's internal write-buffer plumbing. The fix captures the result in a local variable inside the block instead of trusting the method's return value.

Both were caught by the specs written for this exact purpose, before either one could reach production.

## One naming collision, caught before it ever ran

The plan doc itself names this phase's service namespace `CvScreening::` throughout — but `CvScreening` is already a **class** (the model Phase 5 built). Ruby can't reopen a class as a module (`module CvScreening; ...; end` on top of an existing `class CvScreening`), so the app wouldn't even boot. Renamed to `CvScreenings::` (plural) — which, it turns out, matches this app's own actual convention already: `Sessions::`, `Assessments::` are namespaces for services, `Session`/`Assessment` are the models. The plan doc missed its own precedent; the fix just follows it.

## Fixtures — generated, not hand-crafted, and scoped down from the original plan

`bundle exec rake cv_screening:generate_fixtures` writes seven fixture files to `spec/fixtures/files/`, all fabricated content (no real name, no real email, ever — a real CV committed to git history is a privacy incident that never fully goes away). It uses `prawn` (already in this app, used for portfolio PDF exports) to generate real PDFs, and `rubyzip` directly to hand-build a minimal valid DOCX. One deliberate scope reduction: a genuinely *password-protected* PDF isn't something these gems can construct, so that failure path is tested by directly telling the test to pretend `PDF::Reader` raised that specific error, rather than needing a byte-perfect encrypted file.

## Specs

76 examples across 8 new spec files, one per service plus the worker — covering every branch of the decision table in the plan doc's §6, the `>=` boundary case specifically, `TextExtractor` against every fixture (plus the stubbed encryption case), and the worker's idempotency + tenancy behavior.

## Running it yourself

```bash
cd api
bundle install
bundle exec rails db:migrate
bundle exec rake cv_screening:generate_fixtures
bundle exec rspec
bundle exec rails zeitwerk:check
```
