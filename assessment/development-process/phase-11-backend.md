# Phase 11 — Backend changes, explained for a frontend dev

One endpoint gets stricter. No new tables, no new service, no new worker — this phase closes a
real gap in an endpoint Phase 8 already built.

## Why this phase exists

A CV that doesn't have a parseable email address in it lands as `needs_review` /
`no_email_detected`. Before this phase, a recruiter could still click Invite or Reject on that
entry — the endpoint's own comment said "No detected_email is fine." But two things downstream
both assume an email exists:

- `CvScreenings::Inviter` sets `candidate_name: @entry.detected_email` — with no detected email,
  that's `nil`.
- `CvScreeningMailer#invited`/`#not_advanced` does `mail(to: entry.detected_email, ...)` — again
  `nil`.

`CvScreenings::BatchNotifier.send_now!` wraps that mail send in a broad `rescue StandardError` that
only logs the error — it doesn't re-raise, doesn't retry, doesn't tell the recruiter anything went
wrong. So the recruiter would click Invite, see it apparently succeed (the entry flips to
`invited`), and no candidate would ever actually be notified. This phase closes that gap by
requiring an email up front, before any of that downstream code runs.

## The endpoint change

`POST /api/v1/cv_screening_entries/:id/review` (`cv_screening_entries_controller.rb`) already took
`{ action: 'invite' | 'reject' }`. It now also accepts an optional `email`, but only *acts* on it
when the entry doesn't already have one:

```ruby
def review
  action = request_body[:action]
  return json_error("action must be 'invite' or 'reject'", :unprocessable_entity) unless %w[invite reject].include?(action)

  if @entry.detected_email.blank?
    email = request_body[:email].presence
    return json_error('An email address is required...', :unprocessable_entity) if email.nil?
    return json_error('Enter a valid email address.', :unprocessable_entity) unless email.match?(URI::MailTo::EMAIL_REGEXP)

    @entry.update!(detected_email: email)
  end

  case action
  when 'invite'  then ... # unchanged
  when 'reject'  then ... # unchanged
  end
end
```

`URI::MailTo::EMAIL_REGEXP` is Ruby's own standard-library email-format regex (from the `uri` gem
— no new dependency). It's the right tool *here* specifically because this is validating one
complete, user-typed string end to end. That's different from `CvScreenings::EmailDetector`
(Phase 6), which scans a whole block of freeform CV text looking for an email-shaped *substring*
anywhere in it — a whole-string-anchored regex like this one would never match there, which is why
that class deliberately uses a different, unanchored pattern instead.

Once the email is persisted to `@entry.detected_email`, the existing `invite`/`reject` branches —
`CvScreenings::Inviter` and `CvScreeningMailer` — run completely unchanged. Neither of those files
was touched by this phase; they were already correct, they just never used to reliably get a real
email to work with.

If the entry already has a `detected_email` (the common case — most CVs do parse one out), the
`email` param is ignored entirely and this whole new branch is skipped. Existing behavior for
those entries is byte-for-byte the same as before this phase.

## Specs

`spec/requests/api/v1/cv_screening_entries_spec.rb`: the two pre-existing "invites"/"rejects"
specs now create their entry with an explicit `detected_email`, since they used to rely on the
now-removed "no email is fine" bypass. Three new cases cover the no-email path directly: no
`email` param → `422`, entry untouched; an invalid-format `email` → `422`; a valid `email` → `200`,
`detected_email` persisted, and — asserting the fix actually closes the loop end-to-end — the
created session's `candidate_name` matches the submitted address.

## Running it yourself

```bash
cd api
bundle exec rspec spec/requests/api/v1/cv_screening_entries_spec.rb
bundle exec rspec
bundle exec rails zeitwerk:check
```
