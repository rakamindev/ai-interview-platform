# frozen_string_literal: true

module FitGap
  # Pure, deterministic comparison of a candidate's (override-aware) skill levels
  # against a vacancy's required levels. No I/O, no AI: the same inputs always give
  # the same output, so it is safe to recompute synchronously on every override.
  #
  # Rules (the acceptance criteria this class is tested against):
  #   * A vacancy skill is matched to a portfolio skill by skill_id when both have one,
  #     otherwise by normalised label (case / surrounding / repeated whitespace ignored).
  #   * No matching portfolio skill            -> result "not_assessed" (never a "gap":
  #     absence of evidence is not evidence of absence).
  #   * delta = candidate_level - required_level -> exceed (>0), match (0), gap (<0).
  #   * An assessor override beats the AI level; `is_override` tells the UI.
  #   * `low_evidence` is true when the AI confidence is "low" and no human reviewed it,
  #     so a "gap" can be presented as "needs verification", not as a verdict.
  #   * Duplicate vacancy rows for the same skill collapse to the strictest requirement.
  class Comparator
    LOW_CONFIDENCE = 'low'

    Skill = Struct.new(:skill_id, :skill_label, :level, :ai_level, :confidence, :overridden, keyword_init: true)

    # vacancy_skills: [{ skill_id:, skill_label:, expected_level: }]
    # portfolio_skills: [{ skill_id:, skill_label:, ai_level:, override_level:, confidence: }]
    def self.call(vacancy_skills:, portfolio_skills:)
      new(vacancy_skills, portfolio_skills).call
    end

    def initialize(vacancy_skills, portfolio_skills)
      @vacancy_skills   = Array(vacancy_skills).map { |s| s.to_h.symbolize_keys }
      @portfolio_skills = Array(portfolio_skills).map { |s| build_skill(s.to_h.symbolize_keys) }
    end

    def call
      comparisons = required_skills.map { |required| compare(required) }
      { comparisons: comparisons, summary: summarize(comparisons) }
    end

    def self.normalize_label(label)
      label.to_s.unicode_normalize(:nfkc).squish.downcase
    end

    private

    def build_skill(raw)
      override = raw[:override_level]
      Skill.new(
        skill_id:    raw[:skill_id].presence,
        skill_label: raw[:skill_label].to_s,
        level:       override || raw[:ai_level],
        ai_level:    raw[:ai_level],
        confidence:  raw[:confidence].to_s.downcase.presence,
        overridden:  !override.nil?
      )
    end

    # One row per distinct required skill; strictest level wins on duplicates.
    def required_skills
      @vacancy_skills
        .reject { |s| s[:skill_label].to_s.strip.empty? }
        .group_by { |s| s[:skill_id].presence || self.class.normalize_label(s[:skill_label]) }
        .values
        .map { |rows| rows.max_by { |r| r[:expected_level].to_i } }
    end

    def find_candidate_skill(required)
      by_id = required[:skill_id].presence &&
              @portfolio_skills.find { |s| s.skill_id == required[:skill_id] }
      by_id || @portfolio_skills.find do |s|
        self.class.normalize_label(s.skill_label) == self.class.normalize_label(required[:skill_label])
      end
    end

    def compare(required)
      required_level = required[:expected_level].to_i
      candidate      = find_candidate_skill(required)

      base = {
        skill_label:    required[:skill_label].to_s.squish,
        skill_id:       required[:skill_id].presence,
        required_level: required_level,
        expected_level: required_level # legacy key, kept for existing export consumers
      }

      return base.merge(not_assessed_fields) if candidate.nil? || candidate.level.nil?

      delta = candidate.level - required_level
      base.merge(
        candidate_level: candidate.level,
        ai_level:        candidate.ai_level,
        is_override:     candidate.overridden,
        result:          result_for(delta),
        delta:           delta,
        confidence:      candidate.confidence,
        low_evidence:    candidate.confidence == LOW_CONFIDENCE && !candidate.overridden
      )
    end

    def not_assessed_fields
      { candidate_level: nil, ai_level: nil, is_override: false, result: 'not_assessed',
        delta: nil, confidence: nil, low_evidence: false }
    end

    def result_for(delta)
      return 'match'  if delta.zero?

      delta.positive? ? 'exceed' : 'gap'
    end

    def summarize(comparisons)
      total    = comparisons.size
      counts   = comparisons.group_by { |c| c[:result] }.transform_values(&:size)
      assessed = total - counts.fetch('not_assessed', 0)

      {
        total:                 total,
        assessed:              assessed,
        match:                 counts.fetch('match', 0),
        exceed:                counts.fetch('exceed', 0),
        gap:                   counts.fetch('gap', 0),
        not_assessed:          counts.fetch('not_assessed', 0),
        low_evidence:          comparisons.count { |c| c[:low_evidence] },
        overridden:            comparisons.count { |c| c[:is_override] },
        coverage_pct:          total.zero? ? nil : ((assessed * 100.0) / total).round
      }
    end
  end
end
