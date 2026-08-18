# frozen_string_literal: true

module Portfolios
  class InvalidOutput < StandardError; end

  # Validates Gemini Portfolio JSON before any existing skills are replaced.
  class OutputValidator
    MISSING = Object.new.freeze

    def initialize(data:, assessment:)
      @data = data
      @assessment = assessment
    end

    def call
      raise InvalidOutput, "Portfolio response must be a JSON object" unless @data.is_a?(Hash)

      configured_raw = required_value(@data, "configured_skills")
      discovered_raw = required_value(@data, "discovered_skills")
      unless configured_raw.is_a?(Array) && discovered_raw.is_a?(Array)
        raise InvalidOutput, "Portfolio skills must be arrays"
      end

      expected_skills = @assessment.assessment_skills.order(:display_order).to_a
      configured, configured_keys = validate_configured_skills(configured_raw, expected_skills)
      expected_keys = expected_skills.map { |skill| skill_identity(skill) }
      missing_keys = expected_keys - configured_keys

      unless missing_keys.empty?
        raise InvalidOutput, "missing configured skill: #{missing_keys.join(', ')}"
      end

      discovered = discovered_raw.map { |skill| validate_discovered_skill(skill) }
      all_labels = configured.map { |skill| normalize_label(skill[:skill_label]) }
      discovered.each do |skill|
        label = normalize_label(skill[:skill_label])
        raise InvalidOutput, "duplicate skill: #{skill[:skill_label]}" if all_labels.include?(label)

        all_labels << label
      end

      { configured_skills: configured, discovered_skills: discovered }
    end

    private

    def validate_configured_skills(raw_skills, expected_skills)
      seen_keys = []

      normalized = raw_skills.map do |raw_skill|
        validate_hash!(raw_skill)
        raw_skill_id = optional_value(raw_skill, "skill_id")
        raw_skill_id = nil if raw_skill_id.equal?(MISSING)
        raw_label = text_value(raw_skill, "skill_label")
        expected = find_expected_skill(expected_skills, raw_skill_id, raw_label)
        key = skill_identity(expected)

        raise InvalidOutput, "duplicate configured skill: #{raw_label}" if seen_keys.include?(key)

        seen_keys << key
        common = validate_common_fields(raw_skill)

        common.merge(
          skill_id: expected.skill_id,
          skill_label: expected.skill_label
        )
      end

      [normalized, seen_keys]
    end

    def validate_discovered_skill(raw_skill)
      validate_hash!(raw_skill)
      common = validate_common_fields(raw_skill)
      label = text_value(raw_skill, "skill_label")

      common.merge(skill_id: nil, skill_label: label)
    end

    def validate_common_fields(raw_skill)
      level = required_value(raw_skill, "level")
      confidence = text_value(raw_skill, "confidence")
      evidence = required_value(raw_skill, "evidence")
      competency_summary = text_value(raw_skill, "competency_summary")

      unless level.is_a?(Integer) && level.between?(1, 5)
        raise InvalidOutput, "skill level must be an integer between 1 and 5"
      end

      unless PortfolioSkill::CONFIDENCE_LEVELS.include?(confidence)
        raise InvalidOutput, "skill confidence is invalid"
      end

      unless evidence.is_a?(Array) && evidence.all? { |quote| quote.is_a?(String) }
        raise InvalidOutput, "skill evidence must be an array of strings"
      end

      {
        level: level,
        confidence: confidence,
        evidence: evidence.first(3),
        competency_summary: competency_summary
      }
    end

    def find_expected_skill(expected_skills, raw_skill_id, raw_label)
      if raw_skill_id.present?
        expected = expected_skills.find { |skill| skill.skill_id == raw_skill_id }
        return expected if expected
      end

      # Gemini may synthesize an ID for custom assessment skills whose stored
      # skill_id is nil. Exact canonical label remains safe fallback; semantic
      # or fuzzy matching is never allowed.
      expected = expected_skills.find do |skill|
        normalize_label(skill.skill_label) == normalize_label(raw_label)
      end
      return expected if expected

      raise InvalidOutput, "unknown configured skill: #{raw_label}"
    end

    def skill_identity(skill)
      if skill.skill_id.present?
        "id:#{skill.skill_id}"
      else
        "label:#{normalize_label(skill.skill_label)}"
      end
    end

    def validate_hash!(value)
      return if value.is_a?(Hash)

      raise InvalidOutput, "each Portfolio skill must be a JSON object"
    end

    def text_value(hash, key)
      value = required_value(hash, key)
      return value if value.is_a?(String) && value.present?

      raise InvalidOutput, "#{key} must be a non-empty string"
    end

    def required_value(hash, key)
      value = optional_value(hash, key)
      return value unless value.equal?(MISSING)

      raise InvalidOutput, "missing Portfolio field: #{key}"
    end

    def optional_value(hash, key)
      return hash[key] if hash.key?(key)
      return hash[key.to_sym] if hash.key?(key.to_sym)

      MISSING
    end

    def normalize_label(label)
      label.to_s.strip.downcase.gsub(/\s+/, " ")
    end
  end
end
