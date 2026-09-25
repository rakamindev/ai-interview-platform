# frozen_string_literal: true

module Portfolios
  class ResultValidator
    class InvalidResult < StandardError; end

    def initialize(session)
      @session = session
    end

    def call(response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      fail_result('response is not a JSON object') unless data.is_a?(Hash)
      configured = data['configured_skills']
      discovered = data['discovered_skills']
      fail_result('skill collections must be arrays') unless configured.is_a?(Array) && discovered.is_a?(Array)
      fail_result('too many skills returned') if configured.size + discovered.size > 500
      candidates = @session.transcript_turns.where(speaker: 'candidate').pluck(:text).map { |text| normalize(text) }
      catalog = @session.assessment.assessment_skills.order(:display_order).map { |s| [s, false] } +
                @session.coverage_maps.discovered.order(:id).map { |s| [s, true] }
      seen = {}
      (configured.map { |s| [s, false] } + discovered.map { |s| [s, true] }).each do |item, is_discovered|
        fail_result('skill entry is malformed') unless item.is_a?(Hash) && item['skill_label'].is_a?(String)
        matches = catalog.select do |skill, flag|
          flag == is_discovered && if item['skill_id'].present? && !is_discovered
            skill.skill_id == item['skill_id']
          else
            normalize(skill.skill_label).casecmp?(normalize(item['skill_label']))
          end
        end
        unless matches.one?
          kind = is_discovered ? 'discovered' : 'configured'
          fail_result("unknown or ambiguous #{kind} skill: label=#{item['skill_label'].inspect} id=#{item['skill_id'].inspect}")
        end
        skill, flag = matches.first
        key = [flag, skill.id]
        fail_result("duplicate skill: #{skill.skill_label.inspect}") if seen.key?(key)
        level = item['level']
        fail_result("invalid level for #{skill.skill_label.inspect}") unless level.nil? || (level.is_a?(Integer) && (1..5).cover?(level))
        fail_result("invalid confidence for #{skill.skill_label.inspect}") unless %w[high medium low].include?(item['confidence'])
        fail_result("invalid evidence for #{skill.skill_label.inspect}") unless item['evidence'].is_a?(Array) && item['evidence'].all? { |q| q.is_a?(String) }
        fail_result("missing summary for #{skill.skill_label.inspect}") unless item['competency_summary'].is_a?(String) && item['competency_summary'].present?
        evidence = item['evidence'].select do |quote|
          normalized = normalize(quote)
          normalized.present? && candidates.any? { |turn| turn.include?(normalized) }
        end.uniq.first(3)
        level = nil if evidence.empty?
        seen[key] = {
          skill_id: flag ? nil : skill.skill_id, skill_label: skill.skill_label, is_discovered: flag,
          ai_level: level, ai_confidence: level ? item['confidence'] : 'low', evidence: evidence,
          competency_summary: level ? item['competency_summary'] : 'Insufficient verified interview evidence to assign a level.'
        }
      end
      # Omitted skills remain visible as unassessed, never silently disappear.
      catalog.map do |skill, flag|
        seen[[flag, skill.id]] || {
          skill_id: flag ? nil : skill.skill_id, skill_label: skill.skill_label, is_discovered: flag,
          ai_level: nil, ai_confidence: 'low', evidence: [],
          competency_summary: 'Not assessed: no verified rating was returned.'
        }
      end
    rescue JSON::ParserError, TypeError
      fail_result
    end

    private

    def normalize(text)
      text.gsub(/\s+/, ' ').strip
    end

    def fail_result(reason = nil)
      message = 'Invalid assessment response; existing results were preserved.'
      message = "#{message} #{reason}" if reason
      raise InvalidResult, message
    end
  end
end
