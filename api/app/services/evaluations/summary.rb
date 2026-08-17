# frozen_string_literal: true

module Evaluations
  # Derives a deterministic, auditable summary of how "ready" an evaluation is.
  #
  # Core principle from the evidence-backed evaluation thesis:
  #   * "Not demonstrated" ≠ "poor" — a competency with no evidence is never
  #     scored as zero; it is flagged for human review.
  #   * Score ≠ certainty — confidence and coverage are surfaced separately.
  #
  # This is intentionally pure business logic (no DB writes, no AI) so it is
  # trivially testable and safe to evolve.
  class Summary
    def initialize(portfolio)
      @portfolio = portfolio
      @skills    = Array(portfolio&.portfolio_skills)
    end

    # Returns a hash suitable for the API payload.
    def call
      {
        overall_status: overall_status,
        coverage: {
          assessed: coverage[:assessed],
          total: coverage[:total],
          percent: coverage[:percent]
        },
        needs_review: needs_review?,
        review_reasons: review_reasons,
        skills: skills_summary
      }
    end

    # Assessed / total / percent over all skills that are expected to be scored.
    def coverage
      total = @skills.size
      assessed = @skills.count { |s| status_for(s) == 'assessed' }
      percent = total.zero? ? 0 : ((assessed.to_f / total) * 100).round

      { total:, assessed:, percent: }
    end

    def needs_review?
      review_reasons.any?
    end

    # Explicit, human-readable reasons for flagging human review.
    def review_reasons
      reasons = []

      if @portfolio.nil? || @skills.empty?
        reasons << 'No skills were assessed'
        return reasons
      end

      @skills.each do |skill|
        case status_for(skill)
        when 'not_assessed'
          reasons << "“#{skill.skill_label}” could not be assessed from the available responses"
        when 'partial'
          reasons << "“#{skill.skill_label}” has partial evidence (low confidence)"
        end
      end

      reasons
    end

    def overall_status
      needs_review? ? 'needs_review' : 'ready_for_review'
    end

    # Per-skill derived status: assessed / partial / not_assessed.
    #   assessed     → has a level AND supporting evidence AND confident
    #   partial      → has evidence but low confidence (thin signal)
    #   not_assessed → no evidence or no level (never an artificial zero)
    def status_for(skill)
      return 'not_assessed' unless skill&.ai_level

      evidence = Array(skill.evidence).reject(&:blank?)
      return 'not_assessed' if evidence.empty?

      confidence = skill.ai_confidence.to_s
      confidence == 'low' ? 'partial' : 'assessed'
    end

    private

    def skills_summary
      @skills.map do |skill|
        {
          id: skill.id,
          skill_label: skill.skill_label,
          is_discovered: skill.is_discovered,
          assessment_status: status_for(skill),
          ai_level: skill.ai_level,
          ai_confidence: skill.ai_confidence,
          evidence: Array(skill.evidence),
          counter_evidence: Array(skill.counter_evidence)
        }
      end
    end
  end
end
