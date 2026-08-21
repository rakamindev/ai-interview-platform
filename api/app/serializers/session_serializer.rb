# frozen_string_literal: true

class SessionSerializer
  def initialize(session)
    @session = session
  end

  def as_json
    {
      id: @session.id,
      assessment_id: @session.assessment_id,
      tenant_id: @session.tenant_id,
      candidate_id: @session.candidate_id,
      candidate_name: @session.candidate_name,
      invite_token: @session.invite_token,
      invite_url: @session.invite_url,
      status: @session.status,
      end_reason: @session.end_reason,
      started_at: @session.started_at,
      ended_at: @session.ended_at,
      duration_seconds: @session.duration_seconds,
      created_at: @session.created_at
    }
  end

  def self.render(session)
    new(session).as_json
  end
end
