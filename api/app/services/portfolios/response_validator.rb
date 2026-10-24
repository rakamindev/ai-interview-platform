# frozen_string_literal: true

module Portfolios
  # Validates the entire model response before any existing portfolio skill is replaced.
  class ResponseValidator
    def initialize(response:, configured_skills:, candidate_turns:)
      @response = response
      @configured_skills = configured_skills.to_a
      @candidate_turns = candidate_turns.map { |text| normalize(text) }
    end

    def call
      data = @response.is_a?(String) ? JSON.parse(@response) : @response
      raise ArgumentError, 'Portfolio response must be an object' unless data.is_a?(Hash)

      configured = data.fetch('configured_skills')
      discovered = data.fetch('discovered_skills', [])
      raise ArgumentError, 'Portfolio skill lists must be arrays' unless configured.is_a?(Array) && discovered.is_a?(Array)

      seen = []
      rows = configured.filter_map do |item|
        raise ArgumentError, 'Configured skill must be an object' unless item.is_a?(Hash)

        source = find_configured(item)
        raise ArgumentError, 'Unknown configured skill' unless source

        identity = source.skill_id.presence || normalize(source.skill_label)
        raise ArgumentError, 'Duplicate configured skill' if seen.include?(identity)

        seen << identity
        validate_item(item, skill_id: source.skill_id, skill_label: source.skill_label,
                            is_discovered: false)
      end

      discovered.each do |item|
        raise ArgumentError, 'Discovered skill must be an object' unless item.is_a?(Hash)

        label = item['skill_label'].to_s.strip
        identity = normalize(label)
        raise ArgumentError, 'Duplicate or blank discovered skill' if identity.blank? || seen.include?(identity)

        seen << identity
        row = validate_item(item, skill_id: nil, skill_label: label, is_discovered: true)
        rows << row if row
      end

      rows
    rescue JSON::ParserError
      raise ArgumentError, 'Invalid portfolio response JSON'
    end

    private

    def normalize(value)
      value.to_s.gsub(/[“”"']/, '').squish.downcase
    end

    def find_configured(item)
      id = item['skill_id'].to_s.strip
      by_id = @configured_skills.find { |skill| skill.skill_id.to_s.casecmp?(id) } if id.present?
      if by_id
        label = normalize(item['skill_label'])
        raise ArgumentError, 'Conflicting configured skill ID and label' if label.present? && label != normalize(by_id.skill_label)
        return by_id
      end

      label = normalize(item['skill_label'])
      return nil if label.blank?

      matches = @configured_skills.select { |skill| normalize(skill.skill_label) == label }
      return nil unless matches.one?
      return nil if id.present? && matches.first.skill_id.present?

      matches.first
    end

    def validate_item(item, skill_id:, skill_label:, is_discovered:)
      level = item['level']
      confidence = item['confidence']
      evidence = item['evidence']
      summary = item['competency_summary']

      raise ArgumentError, 'Invalid skill level' unless level.is_a?(Integer) && (1..5).cover?(level)
      raise ArgumentError, 'Invalid confidence' unless PortfolioSkill::CONFIDENCE_LEVELS.include?(confidence)
      raise ArgumentError, 'Invalid skill label length' unless skill_label.length.between?(1, 255)
      raise ArgumentError, 'Invalid competency summary' unless summary.is_a?(String) && summary.strip.present? && summary.length <= 3000
      raise ArgumentError, 'Evidence must be an array' unless evidence.is_a?(Array) && evidence.length <= 3

      evidence.each do |quote|
        normalized = normalize(quote)
        unless quote.is_a?(String) && normalized.present? && quote.length <= 2000 &&
               Portfolios::EvidenceVerifier.present_in_turns?(quote, @candidate_turns)
          raise ArgumentError, 'Unverified candidate quote'
        end
      end

      # No quote means no defensible level. Omit the row so comparison is not_assessed.
      return nil if evidence.empty?

      {
        skill_id: skill_id,
        skill_label: skill_label,
        is_discovered: is_discovered,
        ai_level: level,
        ai_confidence: confidence,
        evidence: evidence,
        competency_summary: summary.strip
      }
    end
  end
end
