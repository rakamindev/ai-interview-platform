# frozen_string_literal: true

module Portfolios
  # Validates and normalises raw model output before persistence.
  # A missing or out-of-range level is recorded as unrated with a reason,
  # never silently coerced to L1. Unknown confidence values are replaced
  # with nil (the Postgres enum allows nil). Summaries and evidence are
  # truncated to safe lengths.
  class ResponseValidator
    VALID_LEVELS = (1..5)
    VALID_CONFIDENCE = %w[high medium low].freeze
    MAX_SUMMARY_LEN = 2000
    MAX_EVIDENCE    = 3

    SkillResult = Data.define(
      :skill_id, :skill_label, :is_discovered,
      :ai_level, :rating_state,
      :ai_confidence, :evidence, :competency_summary
    )

    def call(raw_skills, is_discovered:)
      Array(raw_skills).map { |raw| normalize(raw, is_discovered: is_discovered) }
    end

    private

    # AC-2.4: "L3" → 3, 3.7 → 3, "three" → nil, "3" → 3
    def coerce_level(raw_level)
      return nil if raw_level.nil?

      int_level = case raw_level
                  when Integer then raw_level
                  when Float  then raw_level.round
                  when String then raw_level.sub(/\A[Ll]/, "").to_i
                  else return nil
                  end

      VALID_LEVELS.include?(int_level) ? int_level : nil
    end

    def normalize(raw, is_discovered:)
      level = coerce_level(raw["level"])

      if level
        rating_state = "rated"
        ai_level     = level
      else
        rating_state = "unrated"
        ai_level     = nil
      end

      confidence = raw["confidence"]
      confidence = nil unless VALID_CONFIDENCE.include?(confidence)

      # AC-2.7: missing summary → placeholder (column is NOT NULL)
      summary = raw["competency_summary"].to_s.strip
      summary = summary[0, MAX_SUMMARY_LEN] if summary.length > MAX_SUMMARY_LEN
      summary = "Not assessed" if summary.empty?

      evidence = Array(raw["evidence"]).first(MAX_EVIDENCE)

      SkillResult.new(
        skill_id: raw["skill_id"],
        skill_label: raw["skill_label"],
        is_discovered: is_discovered,
        ai_level: ai_level,
        rating_state: rating_state,
        ai_confidence: confidence,
        evidence: evidence,
        competency_summary: summary
      )
    end
  end
end
