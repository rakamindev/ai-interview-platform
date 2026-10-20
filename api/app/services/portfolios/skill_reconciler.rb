# frozen_string_literal: true

module Portfolios
  # Turns raw model output into portfolio_skills attributes.
  #
  # Rules:
  # - Every configured skill appears exactly once, with skill_id/label from the assessment.
  # - A level is kept only if it is readable (1..5) AND backed by at least one candidate quote;
  #   otherwise the skill is "not assessed" (level and confidence nil) — never a default L1.
  # - Discovered skills are kept only when assessed, and never duplicate a configured skill.
  class SkillReconciler
    class MalformedResponse < StandardError; end

    MAX_SUMMARY = 2_000
    MAX_QUOTE = 500
    MAX_QUOTES = 3
    MAX_LABEL = 255

    def initialize(assessment_skills:, response:)
      @assessment_skills = assessment_skills.to_a
      @response = response
    end

    def call
      data = parse(@response)
      model_configured = entries(data['configured_skills'])
      model_discovered = entries(data['discovered_skills'])

      configured_rows = @assessment_skills.map do |skill|
        entry = model_configured.find { |e| matches?(e, skill) }
        model_configured.delete(entry)
        rating(entry).merge(skill_id: skill.skill_id, skill_label: skill.skill_label, is_discovered: false)
      end

      configured_rows + discovered_rows(model_configured + model_discovered, configured_rows)
    end

    private

    def parse(response)
      data = response.is_a?(String) ? JSON.parse(response) : response
      return data if data.is_a?(Hash)

      raise MalformedResponse, "Model response was not usable (expected a JSON object, got #{data.class})"
    rescue JSON::ParserError
      raise MalformedResponse, 'Model response was not usable (expected a JSON object, got text)'
    end

    def entries(value)
      Array.wrap(value).select { |e| e.is_a?(Hash) }
    end

    def matches?(entry, skill)
      same_id = skill.skill_id.present? && normalize(entry['skill_id']) == normalize(skill.skill_id)
      same_id || normalize(entry['skill_label']) == normalize(skill.skill_label)
    end

    # Unmatched or discovered entries: assessed only, first entry per label, no clash with configured skills.
    def discovered_rows(model_entries, configured_rows)
      taken = configured_rows.map { |r| normalize(r[:skill_label]) }

      model_entries.filter_map do |entry|
        label = entry['skill_label'].to_s.strip.truncate(MAX_LABEL, omission: '…')
        attrs = rating(entry)
        next if label.blank? || attrs[:ai_level].nil? || taken.include?(normalize(label))

        taken << normalize(label)
        attrs.merge(skill_id: nil, skill_label: label, is_discovered: true)
      end
    end

    def rating(entry)
      entry ||= {}
      level    = RatingParser.level(entry['level'])
      evidence = quotes(entry['evidence'])
      assessed = level.present? && evidence.any?

      {
        ai_level:           assessed ? level : nil,
        ai_confidence:      assessed ? RatingParser.confidence(entry['confidence']) : nil,
        evidence:           evidence,
        competency_summary: text(entry['competency_summary'], MAX_SUMMARY)
      }
    end

    def quotes(value)
      Array.wrap(value).filter_map { |q| text(q, MAX_QUOTE) }.first(MAX_QUOTES)
    end

    def text(value, limit)
      return unless value.is_a?(String) && value.strip.present?

      value.strip.truncate(limit, omission: '…')
    end

    def normalize(label)
      label.to_s.strip.downcase
    end
  end
end
