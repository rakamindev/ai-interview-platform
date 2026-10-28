# frozen_string_literal: true

module Portfolios
  # Derives a skill's assessment_status (see db/migrate/
  # 20261024063750_add_assessment_status_to_portfolio_skills.rb) and
  # confidence from data this app already owns — the session's coverage map
  # — rather than from whatever the LLM reports about itself.
  #
  # This is the single place that decides "was this skill actually
  # assessed." Portfolios::Generator is SkillStatus's only caller and the
  # only writer of assessment_status; FitGap::Engine, the API serializers,
  # the PDF export, and the frontend all just read the stored value.
  class SkillStatus
    Result = Struct.new(:status, :level, :confidence, keyword_init: true)

    ASSESSED = "assessed"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    NOT_ASSESSED = "not_assessed"

    # coverage:       a CoverageMap for this skill, or nil if none exists.
    # raw_level:      whatever the LLM returned for "level" — untrusted.
    # evidence_count: Integer, already counted by the caller.
    def self.derive(coverage:, raw_level:, evidence_count:)
      level = parse_level(raw_level)

      # The interview never reached this skill (or coverage was never even
      # configured for it) — no level the LLM reports can override that; a
      # model answering about something it was never shown evidence for is
      # exactly the failure mode this class exists to catch.
      return Result.new(status: NOT_ASSESSED, level: nil, confidence: "low") if not_yet?(coverage)

      confidence = derive_confidence(coverage: coverage, evidence_count: evidence_count)

      if level.nil? || confidence == "low" || evidence_count.zero?
        Result.new(status: INSUFFICIENT_EVIDENCE, level: level, confidence: confidence)
      else
        Result.new(status: ASSESSED, level: level, confidence: confidence)
      end
    end

    # Confidence rule taken from the generator's own prompt instructions
    # (app/services/portfolios/generator.rb) and made authoritative here
    # instead of trusting the LLM's self-reported confidence field.
    def self.derive_confidence(coverage:, evidence_count:)
      return "low" if coverage.nil?

      case coverage.state
      when "covered"
        coverage.probe_count >= 3 ? "high" : "medium"
      when "partial"
        "medium"
      else # "initiated" — "not_yet" is already handled by #derive
        "low"
      end
    end
    private_class_method :derive_confidence

    def self.not_yet?(coverage)
      coverage.nil? || coverage.state == "not_yet"
    end
    private_class_method :not_yet?

    # Integer in 1..5, or nil for anything that can't be cleanly read as
    # one — never clamps an out-of-range or malformed value into a false
    # in-range one (that was the original bug: "L3".to_i is 0, and
    # 0.clamp(1,5) is 1 — a parse failure silently became a real level).
    def self.parse_level(raw_level)
      case raw_level
      when Integer
        raw_level.between?(1, 5) ? raw_level : nil
      when Float
        raw_level == raw_level.to_i ? parse_level(raw_level.to_i) : nil
      when String
        match = raw_level.strip.match(/\A[Ll]?(\d+)\z/)
        match ? parse_level(match[1].to_i) : nil
      end
    end
  end
end
