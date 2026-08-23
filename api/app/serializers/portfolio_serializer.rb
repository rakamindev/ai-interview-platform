# frozen_string_literal: true

class PortfolioSerializer
  def initialize(portfolio)
    @portfolio = portfolio
  end

  def as_json(**)
    {
      id:                portfolio.id,
      session_id:        portfolio.session_id,
      candidate_id:      portfolio.candidate_id,
      generation_status: portfolio.generation_status,
      generated_at:      portfolio.generated_at,
      generation_error:  portfolio.generation_error,
      skills:            skills_json,
      overrides:         overrides_json
    }
  end

  private

  attr_reader :portfolio

  def skills_json
    portfolio.portfolio_skills.map do |skill|
      {
        id:                 skill.id,
        skill_id:           skill.skill_id,
        skill_label:        skill.skill_label,
        is_discovered:      skill.is_discovered,
        ai_level:           skill.ai_level,
        ai_confidence:      skill.ai_confidence,
        evidence:           skill.evidence_quotes,
        competency_summary: skill.competency_summary
      }
    end
  end

  def overrides_json
    portfolio.assessor_overrides.map do |override|
      AssessorOverrideSerializer.new(override).as_json
    end
  end
end
