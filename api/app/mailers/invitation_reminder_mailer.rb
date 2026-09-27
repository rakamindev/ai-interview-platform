
# frozen_string_literal: true

class InvitationReminderMailer < ActionMailer::Base
  def reminder(session_id)
    session = Session.unscoped.find(session_id)

    assessment = Assessment.unscoped
      .where(tenant_id: session.tenant_id)
      .find(session.assessment_id)

    @candidate_name = session.candidate_name.presence || "Candidate"
    @assessment_name = assessment.name
    @expires_at = session.expires_at
    @invite_url = session.invite_url

    mail(
      from: ENV.fetch("MAIL_FROM"),
      to: session.candidate_email,
      subject: "Reminder: Complete Your #{@assessment_name} Interview"
    )
  end
end
