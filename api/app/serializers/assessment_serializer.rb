# frozen_string_literal: true

# Single source of truth for Assessment JSON shape.
# Contract specs (spec/requests/api/v1/response_format_spec.rb) assert
# against these exact key-sets.
class AssessmentSerializer
  def initialize(assessment, with_skills: false)
    @assessment  = assessment
    @with_skills = with_skills
  end

  def as_json(**)
    base = {
      id:             assessment.id,
      name:           assessment.name,
      time_limit_min: assessment.time_limit_min,
      language:       assessment.language || 'en',
      created_by:     assessment.created_by,
      created_at:     assessment.created_at,
      updated_at:     assessment.updated_at,
      latest_session: latest_session
    }

    # NOTE: system_prompt is intentionally NOT exposed in list/detail responses.
    return base.merge(skills: skills_json) if with_skills?

    base
  end

  private

  attr_reader :assessment

  def with_skills?
    @with_skills
  end

  def latest_session
    @latest_session ||=
      if assessment.has_attribute?(:ls_id)
        # Preloaded via Assessment.with_latest_session scope (no extra queries).
        assessment.ls_id && {
          id:         assessment.ls_id,
          status:     assessment.ls_status,
          end_reason: assessment.ls_end_reason
        }
      else
        latest = assessment.sessions.max_by(&:created_at)
        latest && {
          id:         latest.id,
          status:     latest.status,
          end_reason: latest.end_reason
        }
      end
  end

  def skills_json
    assessment.assessment_skills.order(:display_order).map do |s|
      {
        id:             s.id,
        skill_id:       s.skill_id,
        skill_label:    s.skill_label,
        is_custom:      s.is_custom,
        scope_include:  s.scope_include,
        scope_exclude:  s.scope_exclude,
        l1_anchor:      s.l1_anchor,
        l2_anchor:      s.l2_anchor,
        l3_anchor:      s.l3_anchor,
        l4_anchor:      s.l4_anchor,
        l5_anchor:      s.l5_anchor,
        expected_level: s.expected_level,
        display_order:  s.display_order
      }
    end
  end
end
