# Phase 15 — Backend changes, explained for a frontend dev

Backend-only — no frontend change in this phase (the UI already had everything it needed from
Phase 14's Cancel/Re-analyze buttons; this phase means those buttons will simply need to be
reached for real less often). This is a genuine bug fix, and a good example of a first fix being
disproved by live evidence rather than just declared done after specs passed.

## How this was found

The user asked why a specific PDF showed "No email detected" in the UI when the email was clearly
in the file (confirmed by reading the PDF's raw content directly). That led to checking the entry's
real `decision_reason` via the API — it was `parse_failed`, not `no_email_detected` at all. The UI
label turned out to be a separate, minor issue: `EntryRow.tsx`'s subtitle
(`entry.detected_email ?? "No email detected"`) is a generic fallback for *any* reason `detected_email`
is null, not an actual diagnosis. But `parse_failed` itself was the real puzzle — this file should
extract cleanly.

Grepping the Rails log for every `TextExtractor` error found two exception classes behind a
surprising number of `parse_failed` results: `ArgumentError` (8 times) and
`ActiveStorage::FileNotFoundError` (2 times) — far more than a handful of genuinely bad files would
explain, especially since these are all real, cleanly-generated PDFs. Re-running extraction against
one of the failing entries' actual stored bytes — both by hand, and by calling the real
`TextExtractor` service directly — succeeded cleanly both times.

## Pass one — a hypothesis that looked right, and wasn't

The first theory: this is a storage-download problem specifically. `ActiveStorage::FileNotFoundError`
is the SDK's own way of saying "the object wasn't there," and a *truncated* download (some bytes
arrived, not all of them) doesn't raise anything on its own — `pdf-reader` just gets handed
incomplete data and can choke on it somewhere inside its own parsing logic with a generic error
like `ArgumentError`. So the first fix added a check comparing the downloaded byte count against
`byte_size` (the size ActiveStorage recorded at upload time):

```ruby
bytes = @attachment.download
if bytes.bytesize != @attachment.byte_size
  raise IncompleteDownloadError, "expected #{@attachment.byte_size} bytes, got #{bytes.bytesize}"
end
```

...plus a rescue clause naming the specific classes believed to be the transient ones
(`ActiveStorage::FileNotFoundError`, `IncompleteDownloadError`, `Aws::Errors::ServiceError`),
re-raising them instead of swallowing them. 100 specs passed. It looked done.

**It wasn't.** The user restarted their Sidekiq worker (ruling out "stale code still running") and
re-uploaded the exact same file that had failed before. It failed again — and the log still showed
`[CvScreenings::TextExtractor] unexpected error: ArgumentError`, meaning it hit the *original*,
generic rescue clause, not the new specific one. A byte-size mismatch was never the actual cause. A
25-attempt concurrent-thread stress test against real entries (simulating Sidekiq's default
10-thread concurrency) didn't reproduce it either. The one consistent fact across every attempt:
manually re-running extraction against the *exact failing entry's* real stored bytes — by hand, and
via the real service — always succeeded. Something about the *original* processing moment failed;
the file and the bytes were never actually the problem.

## Pass two — stop enumerating, invert the trust boundary

The mistake in pass one wasn't the byte-size check (that's still a real, worthwhile thing to catch
— it's kept). The mistake was trying to *name* every exception class that might be transient. That's
the wrong shape for a problem whose exact failure mode was never fully identified.

The fix that actually matches the evidence inverts the logic: instead of listing "known transient"
errors to re-raise, only the parser's own well-understood exceptions are trusted to mean "this file
is genuinely unreadable" — everything else is untrusted by default and propagates:

```ruby
def call
  ...
rescue StandardError => e
  Rails.logger.error("[CvScreenings::TextExtractor] unexpected error, letting Sidekiq retry: #{e.class}: #{e.message}")
  raise
end

private

def extract_pdf(bytes)
  reader = PDF::Reader.new(StringIO.new(bytes))
  ...
rescue PDF::Reader::EncryptedPDFError
  failed(:encrypted)
rescue PDF::Reader::MalformedPDFError, PDF::Reader::UnsupportedFeatureError
  failed(:corrupt)
end
```

`extract_pdf`/`extract_docx` still catch their own parser's *named* exceptions locally and convert
them to a safe `Result` — that part is completely unchanged, and it's what still makes a genuinely
encrypted or malformed PDF land safely on `parse_failed`, exactly as before. But now, anything that
reaches `#call`'s own rescue — the mystery `ArgumentError` included — is, by definition, something
neither parser recognized as a real content problem. Rather than guess it means "corrupt file," it
gets logged and re-raised. `CvScreenings::DecisionEngine#call` (checked directly — it has no rescue
clause anywhere) lets it propagate straight through to `CvScreeningProcessEntryWorker#perform`,
whose existing `rescue StandardError => e; ...; raise` is what actually lets Sidekiq's configured
retries (`retry: 3`) fire. If those are ever exhausted, `sidekiq_retries_exhausted` already lands
the entry on `needs_review` (never a rejection) — so the pipeline's core safety invariant holds
either way; only the failure's *label* and the number of attempts before landing there changes.

## What this doesn't (and can't) prove

The actual root cause of the `ArgumentError` was never pinned down — it never reproduced on demand,
by hand or under simulated concurrency. That's stated plainly rather than papered over: this fix
can't be proven to *eliminate* the underlying glitch, only to stop it from being permanently
mislabeled as file corruption on the very first attempt. If it's genuinely transient (the evidence
strongly suggests it is), Sidekiq's retry should now resolve most occurrences automatically. Actually
confirming that needs a live Sidekiq worker running this code, observed across more uploads than a
single manual retry can settle.

## What didn't need to change

Every other `parse_failed` reason (`:encrypted`, `:corrupt` from a genuinely malformed PDF,
`:legacy_doc`, `:unsupported_type`, `:zero_byte`, `:too_large`) still works exactly as before —
confirmed by the existing `cv_truncated.pdf` fixture spec (a file that was already truncated at
upload time, with a self-consistent recorded `byte_size`) still passing unchanged.

## Specs

`text_extractor_spec.rb`: a stubbed `ActiveStorage::FileNotFoundError` on download propagates; a
stubbed short/truncated download raises `IncompleteDownloadError`; and the old "never raises, even
on a totally unexpected internal error" test was rewritten — its premise no longer holds — to "lets
a totally unrecognized internal error propagate rather than guessing the file is corrupt."
`cv_screening_process_entry_worker_spec.rb` gained a case proving an error raised deep inside
`DecisionEngine` propagates all the way out of `#perform`, leaving the entry at `decision: 'pending'`
(not silently marked failed) — the state a real Sidekiq retry would find and reprocess correctly.
Full suite: 100 examples passing (one test rewritten in place, not net-new).

## Running it yourself

```bash
cd api
bundle exec rspec spec/services/cv_screenings/text_extractor_spec.rb
bundle exec rspec spec/workers/cv_screening_process_entry_worker_spec.rb
bundle exec rspec
bundle exec rails zeitwerk:check
```
