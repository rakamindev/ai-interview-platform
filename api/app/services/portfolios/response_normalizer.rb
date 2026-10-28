# frozen_string_literal: true

module Portfolios
  # Turns the model's portfolio JSON into rows we are willing to store.
  #
  # The model drafts; this class decides. Rules (see the acceptance criteria in
  # assessment/REPORT.md):
  #   * The coverage map, not the model, says which configured skills exist.
  #     A configured skill the model leaves out is recorded as not assessed.
  #   * A skill with zero probes (coverage not_yet) is not assessed, whatever
  #     level the model returns for it.
  #   * Levels must be whole numbers 1..5 ("L3", "3", 3.0 are accepted; 3.5 is
  #     floored, matching "if evidence is mixed, assign the lower level").
  #     Anything else means not assessed — never a guessed number.
  #   * Confidence comes from coverage (PRD 01 §5 rule), not from the model, and
  #     drops to low when no quote can be found in the candidate's own words.
  #   * Evidence quotes are kept only if they match a candidate transcript turn.
  #   * Discovered skills need a valid level and at least one verified quote.
  class ResponseNormalizer
    class InvalidResponse < StandardError; end

    MAX_EVIDENCE      = 3
    MAX_DISCOVERED    = 10
    MAX_SUMMARY_CHARS = 2_000
    MAX_LABEL_CHARS   = 255

    REASON_NEVER_REACHED = 'never_reached'
    REASON_MODEL_OMITTED = 'model_omitted'
    REASON_INVALID_LEVEL = 'invalid_level'

    NOT_ASSESSED_SUMMARIES = {
      REASON_NEVER_REACHED => 'The interview ended before this skill was discussed, so there is no evidence to rate it.',
      REASON_MODEL_OMITTED => 'This skill was discussed, but the AI did not return a rating for it. Review the transcript to rate it.',
      REASON_INVALID_LEVEL => 'The AI returned a rating that is not a valid L1–L5 level. Review the transcript to rate it.'
    }.freeze

    # coverage_maps:   CoverageMap records for the session (configured + discovered)
    # candidate_turns: TranscriptTurn records spoken by the candidate
    def initialize(coverage_maps:, candidate_turns:)
      @configured = coverage_maps.reject(&:is_discovered)
      @discovered = coverage_maps.select(&:is_discovered)
      @matcher    = EvidenceMatcher.new(candidate_turns)
    end

    # Returns an array of attribute hashes for PortfolioSkill.
    # Raises InvalidResponse when the payload is unusable as a whole.
    def call(data)
      raise InvalidResponse, 'model response is not a JSON object' unless data.is_a?(Hash)

      configured_data = array_field(data, 'configured_skills')
      discovered_data = array_field(data, 'discovered_skills')

      if configured_data.empty? && @configured.any? { |m| m.probe_count.to_i.positive? }
        raise InvalidResponse, 'model response contains no skill ratings'
      end

      configured_rows(configured_data) + discovered_rows(discovered_data)
    end

    private

    def array_field(data, key)
      value = data[key]
      return [] if value.nil?
      raise InvalidResponse, "#{key} is not a list" unless value.is_a?(Array)

      value.select { |v| v.is_a?(Hash) }
    end

    def configured_rows(entries)
      @configured.map do |map|
        entry = find_entry(entries, map)
        base  = {
          skill_id:       map.skill_id,
          skill_label:    map.skill_label,
          is_discovered:  false,
          coverage_state: map.state,
          probe_count:    map.probe_count
        }

        if map.probe_count.to_i.zero? || map.state == 'not_yet'
          not_assessed(base, REASON_NEVER_REACHED)
        elsif entry.nil?
          not_assessed(base, REASON_MODEL_OMITTED)
        elsif (level = parse_level(entry['level'])).nil?
          not_assessed(base, REASON_INVALID_LEVEL)
        else
          assessed(base, entry, level, coverage_confidence(map))
        end
      end
    end

    def discovered_rows(entries)
      rows = entries.filter_map do |entry|
        label = clean_label(entry['skill_label'])
        level = parse_level(entry['level'])
        next if label.blank? || level.nil?
        next if configured_label?(label)

        map  = @discovered.find { |m| same_label?(m.skill_label, label) }
        base = {
          skill_id:       nil,
          skill_label:    label,
          is_discovered:  true,
          coverage_state: map&.state,
          probe_count:    map&.probe_count
        }
        row = assessed(base, entry, level, map ? coverage_confidence(map) : 'low')
        row if row[:evidence].any?
      end

      rows.uniq { |r| normalize_label(r[:skill_label]) }.first(MAX_DISCOVERED)
    end

    def assessed(base, entry, level, confidence)
      matches    = Array(entry['evidence']).filter_map { |q| @matcher.match(q) }
                                           .uniq(&:quote)
                                           .first(MAX_EVIDENCE)
      unverified = Array(entry['evidence']).size - matches.size

      base.merge(
        assessment_status:         'assessed',
        status_reason:             nil,
        ai_level:                  level,
        ai_confidence:             matches.empty? ? 'low' : confidence,
        evidence:                  matches.map(&:quote),
        evidence_refs:             matches.map { |m| { quote: m.quote, turn_number: m.turn_number } },
        unverified_evidence_count: [unverified, 0].max,
        competency_summary:        clean_summary(entry['competency_summary'])
      )
    end

    def not_assessed(base, reason)
      base.merge(
        assessment_status:         'not_assessed',
        status_reason:             reason,
        ai_level:                  nil,
        ai_confidence:             nil,
        evidence:                  [],
        evidence_refs:             [],
        unverified_evidence_count: 0,
        competency_summary:        NOT_ASSESSED_SUMMARIES.fetch(reason)
      )
    end

    # PRD 01 §5: high = covered with >= 3 probes; medium = 2 probes or partial;
    # low = otherwise.
    def coverage_confidence(map)
      probes = map.probe_count.to_i
      if map.state == 'covered' && probes >= 3 then 'high'
      elsif probes >= 2 || map.state == 'partial' then 'medium'
      else 'low'
      end
    end

    def parse_level(raw)
      number =
        case raw
        when Integer then raw
        when Float then raw.finite? ? raw.floor : nil
        when String then raw.strip.match(/\A[Ll]?\s*([1-5])(?:\.\d+)?\z/)&.[](1)&.to_i
        end
      number if number&.between?(1, 5)
    end

    def find_entry(entries, map)
      (map.skill_id.present? && entries.find { |e| e['skill_id'].to_s == map.skill_id }) ||
        entries.find { |e| same_label?(e['skill_label'], map.skill_label) }
    end

    def configured_label?(label)
      @configured.any? { |m| same_label?(m.skill_label, label) }
    end

    def same_label?(a, b)
      normalize_label(a) == normalize_label(b) && normalize_label(a).present?
    end

    def normalize_label(label)
      label.to_s.downcase.gsub(/[^\p{L}\p{N}]+/, ' ').strip
    end

    def clean_label(label)
      label.to_s.squish.truncate(MAX_LABEL_CHARS, omission: '…').presence
    end

    def clean_summary(text)
      summary = text.to_s.strip
      summary = 'The AI did not provide a summary for this skill.' if summary.empty?
      summary.truncate(MAX_SUMMARY_CHARS, separator: ' ', omission: '…')
    end
  end
end
