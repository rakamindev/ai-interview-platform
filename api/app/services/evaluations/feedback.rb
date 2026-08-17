# frozen_string_literal: true

module Evaluations
  # Composes a candidate-friendly, non-scoring outcome summary for the
  # token-gated /feedback/:token page (Wow idea W1).
  #
  # Design rules (UU PDP + "candidate dignity" pillar):
  #   * Never expose raw 1–5 levels, confidence grades, or internal override
  #     notes — those are assessor-only signals.
  #   * Never fabricate a score. "Not demonstrated" surfaces as a growth area,
  #     not a zero.
  #   * Deterministic business logic (no AI, no DB writes) so the payload is
  #     fully testable and safe to evolve.
  class Feedback
    def initialize(portfolio)
      @portfolio = portfolio
      @summary   = Evaluations::Summary.new(portfolio)
    end

    def call
      {
        role_title: role_title,
        overall: overall_note,
        strengths: strengths,
        growth_areas: growth_areas,
        coverage: @summary.coverage
      }
    end

    private

    def skills
      Array(@portfolio&.portfolio_skills)
    end

    def role_title
      @portfolio&.session&.assessment&.name.presence || 'the interview'
    end

    # Warm, honest, non-scoring opening line.
    def overall_note
      return 'Thank you for completing the interview.' if skills.empty?

      if @summary.coverage[:percent] >= 100 && @summary.overall_status == 'ready_for_review'
        'Thank you — you covered every area we planned to explore, which gives us a strong, complete picture.'
      else
        'Thank you for completing the interview. A few areas could not be fully explored, and that is entirely normal — it helps us understand what to look at more closely.'
      end
    end

    def strengths
      skills.filter_map do |skill|
        next if @summary.status_for(skill) != 'assessed'

        skill.skill_label
      end
    end

    def growth_areas
      skills.filter_map do |skill|
        status = @summary.status_for(skill)
        next unless %w[partial not_assessed].include?(status)

        skill.skill_label
      end
    end
  end
end
