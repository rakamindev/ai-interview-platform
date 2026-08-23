# frozen_string_literal: true

class AssessmentSerializer
  def initialize(assessment, latest_session: nil)
    @assessment = assessment
    @latest_session = latest_session
  end

  def as_json(with_skills: false)
    data = {
      id: @assessment.id,
      name: @assessment.name,
      time_limit_min: @assessment.time_limit_min,
      language: @assessment.language || "en",
      system_prompt: @assessment.system_prompt,
      created_by: @assessment.created_by,
      created_at: @assessment.created_at,
      updated_at: @assessment.updated_at,
      latest_session: latest_session_json
    }

    data[:skills] = skills_json if with_skills
    data
  end

  def self.render(assessment, latest_session: nil, with_skills: false)
    new(assessment, latest_session: latest_session).as_json(with_skills: with_skills)
  end

  private

  def latest_session_json
    session = @latest_session || @assessment.sessions.order(created_at: :desc).first
    return nil unless session

    {
      id: session.id,
      status: session.status,
      end_reason: session.end_reason
    }
  end

  def skills_json
    @assessment.assessment_skills.order(:display_order).map do |s|
      {
        id: s.id,
        skill_id: s.skill_id,
        skill_label: s.skill_label,
        is_custom: s.is_custom,
        scope_include: s.scope_include,
        scope_exclude: s.scope_exclude,
        l1_anchor: s.l1_anchor,
        l2_anchor: s.l2_anchor,
        l3_anchor: s.l3_anchor,
        l4_anchor: s.l4_anchor,
        l5_anchor: s.l5_anchor,
        expected_level: s.expected_level,
        display_order: s.display_order
      }
    end
  end
end
