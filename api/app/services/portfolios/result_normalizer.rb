require "json"

module Portfolios
  class ResultNormalizer
    VALID_CONFIDENCES = %w[high medium low].freeze
    UNASSESSED_SUMMARY = "No reliable evidence was captured for this skill."

    class InvalidResponse < StandardError
    end

    def initialize(assessment_skills:, response:)
      @assessment_skills = assessment_skills
      @response = response
    end

    def call
      data = parse_response
      configured = collection(data, "configured_skills")
      discovered = collection(data, "discovered_skills")

      configured_results = @assessment_skills.map do |assessment_skill|
        item = find_configured_result(configured, assessment_skill)
        normalize_skill(
          item,
          skill_id: read_value(assessment_skill, :skill_id),
          skill_label: read_value(assessment_skill, :skill_label),
          is_discovered: false
        )
      end

      discovered_results = discovered.each_with_object([]) do |item, result|
        label = read_value(item, "skill_label").to_s.strip
        next if label.empty?
        next if result.any? { |skill| normalize_label(skill[:skill_label]) == normalize_label(label) }

        result << normalize_skill(item, skill_id: nil, skill_label: label, is_discovered: true)
      end

      configured_results + discovered_results
    end

    private

    def parse_response
      parsed = @response.is_a?(Hash) ? @response : JSON.parse(@response.to_s)
      raise InvalidResponse unless parsed.is_a?(Hash)

      parsed
    rescue JSON::ParserError, TypeError
      raise InvalidResponse, "Model response was not valid JSON"
    end

    def collection(data, key)
      value = read_value(data, key)
      return [] unless data.key?(key) || data.key?(key.to_s)
      raise InvalidResponse unless value.is_a?(Array)
      raise InvalidResponse unless value.all? { |item| item.is_a?(Hash) }

      value
    end

    def find_configured_result(items, assessment_skill)
      skill_id = read_value(assessment_skill, :skill_id).to_s
      skill_label = normalize_label(read_value(assessment_skill, :skill_label))

      items.find { |item| !skill_id.empty? && read_value(item, "skill_id").to_s == skill_id } ||
        items.find { |item| normalize_label(read_value(item, "skill_label")) == skill_label }
    end

    def normalize_skill(item, skill_id:, skill_label:, is_discovered:)
      level = normalize_level(read_value(item, "level"))
      summary = normalize_text(read_value(item, "competency_summary"), 2000)
      evidence = normalize_evidence(read_value(item, "evidence"))

      if level.nil? || summary.empty?
        {
          skill_id:,
          skill_label:,
          is_discovered:,
          ai_level: 1,
          rating_status: "not_assessed",
          ai_confidence: "low",
          evidence: [],
          competency_summary: UNASSESSED_SUMMARY
        }
      else
        {
          skill_id:,
          skill_label:,
          is_discovered:,
          ai_level: level,
          rating_status: "rated",
          ai_confidence: normalize_confidence(read_value(item, "confidence")),
          evidence:,
          competency_summary: summary
        }
      end
    end

    def normalize_level(value)
      return value if value.is_a?(Integer) && value.between?(1, 5)
      return value.to_i if value.is_a?(String) && value.match?(/\A[1-5]\z/)

      nil
    end

    def normalize_confidence(value)
      confidence = value.to_s.downcase
      VALID_CONFIDENCES.include?(confidence) ? confidence : "low"
    end

    def normalize_evidence(value)
      return [] unless value.is_a?(Array)

      value.filter_map do |quote|
        next unless quote.is_a?(String)

        normalized = normalize_text(quote, 500)
        normalized unless normalized.empty?
      end.first(3)
    end

    def normalize_text(value, limit)
      value.to_s.strip.slice(0, limit).to_s
    end

    def normalize_label(value)
      value.to_s.strip.downcase.gsub(/\s+/, " ")
    end

    def read_value(object, key)
      return object.public_send(key) if key.is_a?(Symbol) && object.respond_to?(key)
      return nil unless object.is_a?(Hash)

      object[key] || object[key.to_s]
    end
  end
end
