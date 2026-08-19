# frozen_string_literal: true

module FitGap
  # Deterministic decision metadata for assessor-facing fit/gap reports.
  class Summary
    def initialize(comparisons)
      @comparisons = Array(comparisons).map { |comparison| comparison.with_indifferent_access }
    end

    def call
      {
        total_required: total_required,
        assessed_count: assessed_count,
        match_count: result_count('match'),
        exceed_count: result_count('exceed'),
        gap_count: result_count('gap'),
        not_assessed_count: result_count('not_assessed'),
        low_confidence_count: low_confidence_count,
        override_count: override_count,
        critical_gap_count: critical_gap_count,
        readiness_score: readiness_score,
        risk_level: risk_level,
        recommendation: recommendation,
        flags: flags
      }
    end

    private

    attr_reader :comparisons

    def total_required
      comparisons.length
    end

    def assessed_count
      comparisons.count { |comparison| comparison[:candidate_level].present? }
    end

    def result_count(result)
      comparisons.count { |comparison| comparison[:result] == result }
    end

    def low_confidence_count
      comparisons.count { |comparison| comparison[:confidence].to_s.downcase == 'low' }
    end

    def override_count
      comparisons.count { |comparison| comparison[:is_override] || comparison[:overridden] }
    end

    def critical_gap_count
      comparisons.count { |comparison| comparison[:delta].to_i <= -2 }
    end

    def readiness_score
      return 0 if total_required.zero?

      points = comparisons.sum { |comparison| score_for(comparison) }
      ((points / total_required) * 100).round
    end

    def score_for(comparison)
      case comparison[:result]
      when 'match', 'exceed'
        1.0
      when 'gap'
        required = comparison[:required_level] || comparison[:expected_level]
        return 0.0 if required.to_f <= 0

        [comparison[:candidate_level].to_f / required.to_f, 0.9].min
      else
        0.0
      end
    end

    def risk_level
      return 'high' if total_required.zero? || result_count('not_assessed').positive? || critical_gap_count.positive?
      return 'high' if readiness_score < 70
      return 'medium' if result_count('gap').positive? || low_confidence_count.positive? || readiness_score < 85

      'low'
    end

    def recommendation
      case risk_level
      when 'low'
        'Strong fit signal. Proceed with assessor review and validate the strongest evidence.'
      when 'medium'
        'Conditional fit signal. Review gaps, low-confidence evidence, and human overrides before deciding.'
      else
        'High-risk or insufficient fit signal. Re-assess flagged skills before advancing the candidate.'
      end
    end

    def flags
      [].tap do |items|
        items << "#{result_count('not_assessed')} required skill(s) not assessed" if result_count('not_assessed').positive?
        items << "#{critical_gap_count} critical gap(s) of two or more levels" if critical_gap_count.positive?
        items << "#{low_confidence_count} low-confidence assessed skill(s)" if low_confidence_count.positive?
        items << "#{override_count} human override(s) applied" if override_count.positive?
        items << 'No vacancy skills were configured' if total_required.zero?
      end
    end
  end
end
