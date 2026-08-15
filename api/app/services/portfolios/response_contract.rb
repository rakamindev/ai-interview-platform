# frozen_string_literal: true

module Portfolios
  # Turns a raw Gemini response into portfolio_skill attributes, or refuses to.
  #
  # The rule this class exists to enforce: the coverage map is the authority on
  # whether a skill was assessed, and the model is only the authority on what
  # the rating should be *if* it was. Previously the model's output was the sole
  # input and every value it returned was coerced into a legal one —
  # `.to_i.clamp(1, 5)` turned a null into L1 — so a skill nobody asked about
  # arrived in the report as the lowest possible rating.
  #
  # Two consequences of inverting the iteration to walk the coverage map rather
  # than the response:
  #   - a skill the model omits becomes insufficient_evidence, not a missing row
  #   - a skill the model invents is dropped, because a portfolio should describe
  #     what the interview covered, not what the model recalled afterwards
  class ResponseContract
    Result = Struct.new(:skills, :issues, keyword_init: true) do
      def any_skills? = skills.any?
      def issues?     = issues.any?
    end

    LEVEL_PATTERN = /\A[Ll]?\s*([1-5])\z/
    MAX_EVIDENCE  = 3

    def initialize(coverage_maps:)
      @coverage_maps = coverage_maps
      @issues        = []
    end

    def call(response)
      data = response.is_a?(Hash) ? response : safe_parse(response)
      return Result.new(skills: [], issues: @issues) if data.nil?

      indexed = index_model_skills(data)
      skills  = @coverage_maps.map { |map| build_skill(map, indexed) }

      note_unmatched(data, indexed)

      Result.new(skills: skills, issues: @issues)
    end

    private

    def safe_parse(response)
      JSON.parse(response.to_s)
    rescue JSON::ParserError => e
      @issues << "model response was not valid JSON (#{e.class}); no skills recorded"
      nil
    end

    def index_model_skills(data)
      rows = Array(data['configured_skills']) + Array(data['discovered_skills'])

      rows.each_with_object({}) do |row, acc|
        next unless row.is_a?(Hash)

        key = normalise(row['skill_label'])
        next if key.blank?

        # A duplicate emission is not fatal — the first wins and the repeat is
        # recorded. Without the unique index added alongside this class it
        # silently produced two rows for one skill.
        if acc.key?(key)
          @issues << "model returned #{row['skill_label'].inspect} more than once; kept the first"
          next
        end

        acc[key] = row
      end
    end

    def build_skill(map, indexed)
      row  = indexed[normalise(map.skill_label)]
      base = {
        skill_id:      map.skill_id,
        skill_label:   map.skill_label.to_s.strip,
        is_discovered: map.is_discovered
      }

      # Authority check first: no probing means no rating, whatever the model says.
      if never_probed?(map)
        if row && parse_level(row['level'])
          @issues << "model rated #{map.skill_label.inspect} despite coverage state " \
                     "#{map.state}/#{map.probe_count} probes; recorded as not_probed"
        end
        return base.merge(unassessed_attributes(PortfolioSkill::NOT_PROBED, map))
      end

      unless row
        @issues << "model returned no entry for #{map.skill_label.inspect}"
        return base.merge(unassessed_attributes(PortfolioSkill::INSUFFICIENT_EVIDENCE, map))
      end

      level = parse_level(row['level'])
      unless level
        @issues << "model returned an unusable level #{row['level'].inspect} for " \
                   "#{map.skill_label.inspect}; recorded as insufficient_evidence"
        return base.merge(unassessed_attributes(PortfolioSkill::INSUFFICIENT_EVIDENCE, map))
      end

      base.merge(
        assessment_state:   PortfolioSkill::ASSESSED,
        ai_level:           level,
        ai_confidence:      parse_confidence(row['confidence'], map),
        evidence:           parse_evidence(row['evidence'], map),
        competency_summary: parse_summary(row['competency_summary'], map)
      )
    end

    def unassessed_attributes(state, map)
      {
        assessment_state:   state,
        ai_level:           nil,
        ai_confidence:      nil,
        evidence:           [],
        competency_summary: unassessed_summary(state, map)
      }
    end

    def unassessed_summary(state, map)
      if state == PortfolioSkill::NOT_PROBED
        "Not assessed. #{map.skill_label} was not raised during this interview, " \
          'so there is no evidence on which to base a rating.'
      else
        "Insufficient evidence. #{map.skill_label} was discussed across " \
          "#{map.probe_count} probe(s) but the exchange did not support a defensible rating."
      end
    end

    def never_probed?(map)
      map.probe_count.to_i.zero? || map.state == 'not_yet'
    end

    # Accepts an integer or an unambiguous "L3" form. Anything else — nil, a
    # word, 0, 9 — is a refusal, not something to be clamped into range.
    def parse_level(raw)
      case raw
      when Integer then raw.between?(1, 5) ? raw : nil
      when Float   then raw == raw.to_i && raw.to_i.between?(1, 5) ? raw.to_i : nil
      when String  then raw.strip.match(LEVEL_PATTERN)&.captures&.first&.to_i
      end
    end

    # An unrecognised confidence label must not be trusted as high. Downgrading
    # to the most conservative value is the only safe direction, but it is
    # recorded rather than swallowed.
    def parse_confidence(raw, map)
      value = raw.to_s.strip.downcase
      return value if PortfolioSkill::CONFIDENCE_LEVELS.include?(value)

      @issues << "model returned confidence #{raw.inspect} for #{map.skill_label.inspect}; " \
                 'downgraded to low'
      'low'
    end

    def parse_evidence(raw, map)
      unless raw.is_a?(Array)
        @issues << "model returned evidence as #{raw.class} for #{map.skill_label.inspect}; dropped" if raw.present?
        return []
      end

      raw.select { |quote| quote.is_a?(String) && quote.strip.present? }
         .map(&:strip)
         .first(MAX_EVIDENCE)
    end

    def parse_summary(raw, map)
      return raw.strip if raw.is_a?(String) && raw.strip.present?

      @issues << "model returned no competency summary for #{map.skill_label.inspect}"
      "Rated from the interview transcript. No written summary was produced for #{map.skill_label}."
    end

    def note_unmatched(_data, indexed)
      known = @coverage_maps.map { |m| normalise(m.skill_label) }.to_set
      (indexed.keys.to_set - known).each do |key|
        @issues << "model returned #{indexed[key]['skill_label'].inspect}, which is not in the " \
                   'coverage map for this session; dropped'
      end
    end

    def normalise(label) = label.to_s.strip.downcase
  end
end
