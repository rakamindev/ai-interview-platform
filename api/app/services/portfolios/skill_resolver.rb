# frozen_string_literal: true

module Portfolios
  # Decides, for every skill, what the portfolio stores: a level the evidence supports, or "not assessed"
  # with a reason (Step 4, Option B). Pure Ruby: it reads the model's answer, the configured skills, the
  # coverage map and the candidate's words, and touches no database.
  #
  # Per configured skill, in this order:
  #   1. Coverage first. Never probed (not_yet, or no coverage row) -> not_reached, whatever the model said.
  #   2. Missing from the model's answer -> omitted_by_model.
  #   3. Only a whole level from 1 to 5 counts (3, "3", "L3", 3.0). Anything else -> insufficient_evidence.
  #   4. Evidence: keep only quotes found in the candidate's turns. None left -> confidence drops to low.
  class SkillResolver
    MAX_QUOTES    = 3
    QUOTE_LIMIT   = 500
    SUMMARY_LIMIT = 2000
    LABEL_LIMIT   = 255

    # configured_skills: AssessmentSkill records, in display order.
    # coverage_maps:     CoverageMap records for the session (configured and discovered).
    # candidate_texts:   what the candidate said, one string per turn.
    def initialize(configured_skills:, coverage_maps:, candidate_texts:)
      @configured = configured_skills
      @coverage   = coverage_maps.reject(&:is_discovered)
      @candidate_texts = candidate_texts.map { normalize(_1) }
    end

    # data: the parsed model answer, with a configured_skills array.
    # Returns attribute hashes for PortfolioSkill, configured skills first.
    def call(data)
      matched, strays = match_entries(hashes(data['configured_skills']))

      configured_rows = @configured.map { |skill| configured_row(skill, matched[skill]) }
      configured_rows + discovered_rows(hashes(data['discovered_skills']) + strays)
    end

    private

    # Pairs each configured skill with the first entry that names it. Later entries for the same skill are
    # duplicates and are dropped; entries that name no configured skill come back as strays (AC-6).
    def match_entries(entries)
      matched = {}
      strays  = []

      entries.each do |entry|
        skill = find_configured(entry)
        if skill.nil?
          strays << entry
        elsif !matched.key?(skill)
          matched[skill] = entry
        end
      end

      [matched, strays]
    end

    def find_configured(entry)
      id    = entry['skill_id'].to_s.strip.downcase
      label = normalize(entry['skill_label'])

      (id.present? && @configured.find { _1.skill_id.to_s.downcase == id }) ||
        @configured.find { normalize(_1.skill_label) == label }
    end

    def configured_row(skill, entry)
      identity = { skill_id: skill.skill_id, skill_label: skill.skill_label, is_discovered: false }

      return not_assessed(identity, 'not_reached') unless probed?(skill)
      return not_assessed(identity, 'omitted_by_model') if entry.nil?

      rated_or_not(identity, entry)
    end

    def probed?(skill)
      coverage = @coverage.find do |map|
        (skill.skill_id.present? && map.skill_id == skill.skill_id) || normalize(map.skill_label) == normalize(skill.skill_label)
      end
      coverage.present? && coverage.state != 'not_yet'
    end

    # Discovered skills came up in the conversation, so there is no coverage rule for them. They keep the
    # model's label (capped), skip anything that duplicates a configured or earlier discovered skill.
    def discovered_rows(entries)
      seen = @configured.map { normalize(_1.skill_label) }

      entries.filter_map do |entry|
        label = entry['skill_label'].to_s.strip
        next if label.empty? || seen.include?(normalize(label))

        seen << normalize(label)
        rated_or_not({ skill_id: nil, skill_label: truncate(label, LABEL_LIMIT), is_discovered: true }, entry)
      end
    end

    def rated_or_not(identity, entry)
      level = strict_level(entry['level'])
      return not_assessed(identity, 'insufficient_evidence') if level.nil?

      evidence   = verified_quotes(entry['evidence'])
      confidence = evidence.empty? ? 'low' : confidence(entry['confidence'])

      identity.merge(
        ai_level:            level,
        ai_confidence:       confidence,
        evidence:            evidence,
        competency_summary:  entry['competency_summary'].is_a?(String) ? truncate(entry['competency_summary'].strip, SUMMARY_LIMIT).presence : nil,
        not_assessed_reason: nil
      )
    end

    def not_assessed(identity, reason)
      identity.merge(ai_level: nil, ai_confidence: nil, evidence: [], competency_summary: nil, not_assessed_reason: reason)
    end

    # Treat model output like user input: parse strictly, never clamp a bad value into range (P0-1).
    def strict_level(value)
      case value
      when Integer then value if (1..5).cover?(value)
      when Float   then value.to_i if value.finite? && value == value.floor && (1..5).cover?(value.to_i)
      when String  then Regexp.last_match(1).to_i if value.strip =~ /\AL?([1-5])\z/i
      end
    end

    # The model's casing varies ("High"); anything unrecognised is the least certain value, not an error.
    def confidence(value)
      normalized = value.to_s.strip.downcase
      PortfolioSkill::CONFIDENCE_LEVELS.include?(normalized) ? normalized : 'low'
    end

    # A quote shown as "evidence from the interview" must be something the candidate said (P1-5). The match
    # ignores case, spacing and the style of quote marks, but is otherwise exact: a paraphrase is dropped.
    def verified_quotes(quotes)
      seen = []

      Array(quotes).filter_map do |quote|
        next unless quote.is_a?(String)

        normalized = normalize(quote)
        next if normalized.empty? || seen.include?(normalized)
        next unless @candidate_texts.any? { _1.include?(normalized) }

        seen << normalized
        truncate(quote.strip, QUOTE_LIMIT)
      end.first(MAX_QUOTES)
    end

    def normalize(text)
      text.to_s.downcase.tr("‘’‚‛′", "'").tr('“”„‟″', '"').gsub(/\s+/, ' ').strip
    end

    def truncate(text, limit) = text.length > limit ? "#{text[0, limit - 1]}…" : text

    def hashes(list) = Array(list).select { _1.is_a?(Hash) }
  end
end
