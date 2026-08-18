# frozen_string_literal: true

# Candidate-facing emails for CV screening outcomes. Sent with deliver_now, always
# — never deliver_later. With active_job/railtie loaded but MAIL_ENABLED unset in
# production, deliver_later would silently degrade to the in-process :async
# adapter (no persistence, no retries, lost on every pod rollout) — the same trap
# already documented for Phase 4's Sessions::Creator work. The worker calling this
# mailer IS the background job; there's no reason to queue a second one inside it.
class CvScreeningMailer < ActionMailer::Base
  default from: ENV.fetch('MAIL_FROM', 'no-reply@example.com')

  # entry.session must be present — set by CvScreenings::Inviter when the
  # interview session was created.
  def invited(entry)
    @entry = entry
    @session = entry.session

    mail(to: entry.detected_email, subject: "You're invited to interview")
  end

  # Deliberately does NOT receive score, threshold, or any private criterion —
  # only entry.feedback_text, which CvScreenings::FeedbackGenerator itself only
  # ever generates from the vacancy's public requirement text.
  def not_advanced(entry)
    @entry = entry
    @feedback_text = entry.feedback_text

    mail(to: entry.detected_email, subject: 'Update on your application')
  end
end
