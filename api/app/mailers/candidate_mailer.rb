# frozen_string_literal: true

class CandidateMailer < ActionMailer::Base
  default from: 'no-reply@ai-interview-platform.com'

  def invitation_email
    @session = params[:session]
    @assessment = @session.assessment
    
    mail(
      to: @session.candidate_email,
      subject: "Invitation: Assessment for #{@assessment.name}"
    )
  end
end
