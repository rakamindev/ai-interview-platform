# frozen_string_literal: true

module Candidates
  # Rule-based match ranking (no LLM call): every required skill of the
  # vacancy scores match 1.0 / exceed 0.75 / gap 0.25 / not assessed 0;
  # the average is normalized to a percentage. Only sessions with a complete
  # portfolio are ranked.
  class Ranking
    POINTS = { 'match' => 1.0, 'exceed' => 0.75, 'gap' => 0.25 }.freeze

    def initialize(vacancy)
      @vacancy = vacancy
    end

    def call
      requirements = @vacancy.vacancy_skills
      return [] if requirements.empty?

      sessions = Session.joins(:portfolio)
                        .where(portfolios: { generation_status: 'complete' })
                        .includes(:assessment, portfolio: { portfolio_skills: :assessor_override })
                        .order(:candidate_name)

      sessions.filter_map do |session|
        comparisons = build_comparisons(session.portfolio.portfolio_skills, requirements)
        score = (comparisons.sum { |c| c[:points] } / requirements.size.to_f * 100).round

        {
          session_id:      session.id,
          candidate_name:  session.candidate_name.presence || "Candidate ##{session.id}",
          assessment_name: session.assessment&.name || "Assessment ##{session.assessment_id}",
          score:           score,
          skills:          comparisons.map { |c| c.except(:points) }
        }
      end.sort_by { |m| [-m[:score], m[:candidate_name].downcase] }
    end

    private

    def build_comparisons(portfolio_skills, requirements)
      by_label = portfolio_skills.index_by { |s| s.skill_label.downcase }

      requirements.map do |req|
        skill = by_label[req.skill_label.downcase]

        if skill
          override = skill.assessor_override
          effective_level = override ? override.override_level : skill.ai_level
          delta  = effective_level - req.expected_level
          result = delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap')
          {
            skill_label:     req.skill_label,
            expected_level:  req.expected_level,
            candidate_level: effective_level,
            ai_level:        skill.ai_level,
            override_level:  override&.override_level,
            is_override:     override.present?,
            result:          result,
            delta:           delta,
            points:          POINTS.fetch(result)
          }
        else
          {
            skill_label:     req.skill_label,
            expected_level:  req.expected_level,
            candidate_level: nil,
            ai_level:        nil,
            override_level:  nil,
            is_override:     false,
            result:          'not_assessed',
            delta:           nil,
            points:          0.0
          }
        end
      end
    end
  end
end
