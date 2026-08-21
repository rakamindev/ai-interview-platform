# frozen_string_literal: true

class PortfolioSerializer
  def initialize(portfolio)
    @portfolio = portfolio
  end

  def as_json
    {
      id: @portfolio.id,
      session_id: @portfolio.session_id,
      candidate_id: @portfolio.candidate_id,
      generation_status: @portfolio.generation_status,
      generated_at: @portfolio.generated_at,
      generation_error: @portfolio.generation_error,
      skills: @portfolio.portfolio_skills.map { |s| portfolio_skill_json(s) },
      overrides: @portfolio.assessor_overrides.map { |o| override_json(o) }
    }
  end

  def self.render(portfolio)
    new(portfolio).as_json
  end

  private

  def portfolio_skill_json(skill)
    {
      id: skill.id,
      skill_id: skill.skill_id,
      skill_label: skill.skill_label,
      is_discovered: skill.is_discovered,
      ai_level: skill.ai_level,
      ai_confidence: skill.ai_confidence,
      evidence: skill.evidence_quotes,
      competency_summary: skill.competency_summary
    }
  end

  def override_json(override)
    {
      id: override.id,
      portfolio_skill_id: override.portfolio_skill_id,
      ai_level: override.ai_level,
      override_level: override.override_level,
      assessor_notes: override.assessor_notes,
      overridden_by: override.overridden_by,
      overridden_at: override.overridden_at
    }
  end
end
