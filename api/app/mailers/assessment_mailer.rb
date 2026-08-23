# frozen_string_literal: true

class AssessmentMailer < ApplicationMailer
  default from: ENV.fetch("MAILER_FROM", "noreply@ai-interview.local")

  # Notify assessment creator when a candidate finishes their session.
  def session_completed(assessment, session)
    @assessment = assessment
    @session    = session
    @candidate  = session.candidate_name.presence || "Candidate ##{session.candidate_id}"

    mail(
      to: creator_email(assessment),
      subject: "Session completed: #{@candidate} — #{@assessment.name}"
    )
  end

  # Notify assessment creator when portfolio or fit-gap generation fails.
  def generation_failed(assessment, session, error)
    @assessment = assessment
    @session    = session
    @candidate  = session.candidate_name.presence || "Candidate ##{session.candidate_id}"
    @error      = error.to_s.truncate(500)

    mail(
      to: creator_email(assessment),
      subject: "Generation failed: #{@candidate} — #{@assessment.name}"
    )
  end

  private

  def creator_email(assessment)
    user = User.find_by(id: assessment.created_by)
    user&.email || ENV.fetch("ADMIN_EMAIL", "admin@ai-interview.local")
  end
end
