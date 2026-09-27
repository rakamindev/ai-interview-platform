# frozen_string_literal: true

class InvitationMailer < ActionMailer::Base
  def invitation(session_id)
    session = Session.unscoped.find(session_id)

    assessment = Assessment.unscoped
      .where(tenant_id: session.tenant_id)
      .find(session.assessment_id)

    @candidate_name = session.candidate_name.presence || "Candidate"
    @assessment_name = assessment.name
    @expires_at = session.expires_at
    @invite_url = session.invite_url
    @time_limit_min = assessment.time_limit_min

    mail(
      from: ENV.fetch("MAIL_FROM"),
      to: session.candidate_email,
      subject: "You're Invited: #{@assessment_name} Interview"
    )
  end
end