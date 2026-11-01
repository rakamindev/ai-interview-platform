# frozen_string_literal: true

module InterviewSessionHelpers
  def create_interview_session(time_limit_min: 30)
    assessment = Assessment.create!(tenant_id: 42, created_by: 7, name: 'Backend Engineer',
                                    time_limit_min: time_limit_min)
    Session.create!(tenant_id: 42, assessment: assessment)
  end
end
