# frozen_string_literal: true

class AssessorOverrideSerializer
  def initialize(override)
    @override = override
  end

  def as_json(**)
    {
      id:                 override.id,
      portfolio_skill_id: override.portfolio_skill_id,
      ai_level:           override.ai_level,
      override_level:     override.override_level,
      assessor_notes:     override.assessor_notes,
      overridden_by:      override.overridden_by,
      overridden_at:      override.overridden_at
    }
  end

  private

  attr_reader :override
end
