# frozen_string_literal: true

module Portfolios
  # Decides what a report may say about each skill. It checks the model's
  # answer against what the interview actually covered, and never turns a
  # missing or odd rating into a level.
  #
  # The rules, in order:
  #   the interview never reached the skill  -> not_assessed, no level
  #   the model left the skill out           -> unavailable, no level
  #   the level is not a whole number 1-5    -> unavailable, no level (raw value kept)
  #   coverage moved on by itself            -> thin_evidence, caveat auto_advanced
  #   one question or fewer                  -> thin_evidence, caveat low_probe_count
  #   otherwise                              -> assessed
  class SkillResolver
    class InvalidAnswer < StandardError; end

    MAX_QUOTES = 3

    # coverage_maps: the session's coverage maps. The configured ones are the
    #   skills the report must cover, even when the model leaves one out.
    # answer: the model's parsed JSON.
    def initialize(coverage_maps:, answer:)
      @coverage_maps = coverage_maps
      @answer = answer
    end

    # Returns one attribute hash per skill, ready to save as a PortfolioSkill.
    def call
      raise InvalidAnswer, 'The answer has no list of configured skills' unless usable_answer?

      configured_rows + discovered_rows
    end

    private

    def usable_answer?
      @answer.is_a?(Hash) && @answer['configured_skills'].is_a?(Array)
    end

    def configured_rows
      entries = entries_for('configured_skills')

      @coverage_maps.reject(&:is_discovered).map do |map|
        entry = entries.find { |e| same_text?(e['skill_id'], map.skill_id) } ||
                entries.find { |e| same_text?(e['skill_label'], map.skill_label) }
        row(map: map, entry: entry, skill_id: map.skill_id, label: map.skill_label, discovered: false)
      end
    end

    # A discovered skill appears only when the model rated it.
    def discovered_rows
      maps = @coverage_maps.select(&:is_discovered)

      entries_for('discovered_skills').filter_map do |entry|
        label = entry['skill_label']
        next unless label.is_a?(String) && label.strip.present?

        map = maps.find { |m| same_text?(m.skill_label, label) }
        row(map: map, entry: entry, skill_id: nil, label: map&.skill_label || label.strip, discovered: true)
      end
    end

    def row(map:, entry:, skill_id:, label:, discovered:)
      base = {
        skill_id: skill_id,
        skill_label: label,
        is_discovered: discovered,
        coverage_state: map&.state,
        probe_count: map&.probe_count
      }

      # Never discussed: anything the model wrote about it is a guess, so none of it is kept.
      return base.merge(absent('not_assessed')) if map&.state == 'not_yet'
      return base.merge(absent('unavailable')) if entry.nil?

      level = parse_level(entry['level'])
      if level.nil?
        return base.merge(absent('unavailable'), model_text(entry), { raw_level: raw_level(entry) })
      end

      status, caveat = rated_status(map)
      base.merge(model_text(entry), { status: status, caveat: caveat, ai_level: level,
                                      raw_level: nil, ai_confidence: confidence(map) })
    end

    def absent(status)
      { status: status, caveat: nil, ai_level: nil, raw_level: nil,
        ai_confidence: nil, evidence: [], competency_summary: nil }
    end

    # Only a whole number 1-5, or a one-digit string such as "3".
    # Nothing is rounded, clamped or guessed.
    def parse_level(value)
      case value
      when Integer then value if (1..5).cover?(value)
      when String  then value.to_i if value.match?(/\A[1-5]\z/)
      end
    end

    # Kept for operators, as JSON, so null, "" and "7" stay distinguishable.
    def raw_level(entry)
      entry['level'].to_json[0, 50] if entry.key?('level')
    end

    def rated_status(map)
      return ['assessed', nil] if map.nil?
      return %w[thin_evidence auto_advanced] if map.auto_advanced?
      return %w[thin_evidence low_probe_count] if map.probe_count <= 1

      ['assessed', nil]
    end

    # The rubric the prompt gives the model, computed here instead of trusting
    # the model's copy. Where its lines overlap, the lower value wins.
    def confidence(map)
      return 'low' if map.nil?
      return 'high' if map.state == 'covered' && map.probe_count >= 3 && !map.auto_advanced?
      return 'low' if map.probe_count <= 1 || map.state == 'initiated'

      'medium'
    end

    def model_text(entry)
      quotes = Array(entry['evidence']).grep(String).map(&:strip).reject(&:empty?)
      summary = entry['competency_summary']

      { evidence: quotes.first(MAX_QUOTES),
        competency_summary: summary.is_a?(String) ? summary.strip.presence : nil }
    end

    def entries_for(key)
      value = @answer[key]
      value.is_a?(Array) ? value.grep(Hash) : []
    end

    def same_text?(a, b)
      a.is_a?(String) && b.is_a?(String) && a.strip.casecmp?(b.strip)
    end
  end
end
