# frozen_string_literal: true

# Single source of truth for Session JSON shape.
class SessionSerializer
  def initialize(session, include_assessment: false)
    @session            = session
    @include_assessment = include_assessment
  end

  def as_json(**)
    base = {
      id:               session.id,
      assessment_id:    session.assessment_id,
      tenant_id:        session.tenant_id,
      candidate_id:     session.candidate_id,
      candidate_name:   session.candidate_name,
      invite_token:     session.invite_token,
      invite_url:       session.invite_url,
      status:           session.status,
      end_reason:       session.end_reason,
      started_at:       session.started_at,
      ended_at:         session.ended_at,
      duration_seconds: session.duration_seconds,
      created_at:       session.created_at
    }

    return base unless include_assessment?

    base.merge(
      assessment: {
        id:             session.assessment.id,
        name:           session.assessment.name,
        time_limit_min: session.assessment.time_limit_min
      }
    )
  end

  private

  attr_reader :session

  def include_assessment?
    @include_assessment
  end
end
