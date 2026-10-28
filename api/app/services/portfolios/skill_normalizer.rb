# frozen_string_literal: true

module Portfolios
  # Turns one skill entry from the model plus the coverage-map row it belongs to into the
  # attributes of a PortfolioSkill. This is the trust boundary for model output:
  #   - identity (skill_id, label, discovered) comes from the coverage map, never the model
  #   - a skill the interview never reached is not_assessed, whatever the model says
  #   - confidence is computed from coverage (Coverage::Confidence), the model's label is ignored
  #   - an unusable level becomes needs_review instead of a made-up L1
  # It never raises, so one bad skill cannot fail the whole portfolio.
  class SkillNormalizer
    MAX_QUOTES        = 3
    MAX_QUOTE_LENGTH  = 500
    MAX_SUMMARY_LENGTH = 2_000
    LEVEL_PATTERN     = /\A\s*L?\s*([1-5])\s*\z/i

    def self.call(coverage:, entry:)
      new(coverage, entry).call
    end

    def initialize(coverage, entry)
      @coverage = coverage
      @entry    = entry
    end

    def call
      return not_assessed if @coverage.state == 'not_yet'
      return needs_review('The AI returned no rating for this skill.') unless @entry.is_a?(Hash)

      level = parse_level(@entry['level'])
      return needs_review("The AI returned an invalid level (#{@entry['level'].inspect[0, 20]}).") unless level

      identity.merge(
        assessment_status:  'assessed',
        status_reason:      nil,
        ai_level:           level,
        ai_confidence:      confidence,
        evidence:           evidence,
        competency_summary: summary
      )
    end

    private

    def identity
      { skill_id: @coverage.skill_id, skill_label: @coverage.skill_label, is_discovered: @coverage.is_discovered }
    end

    def not_assessed
      identity.merge(
        assessment_status:  'not_assessed',
        status_reason:      'Not discussed in the interview.',
        ai_level:           nil,
        ai_confidence:      nil,
        evidence:           [],
        competency_summary: ''
      )
    end

    # Keeps whatever evidence and summary the model gave, so the assessor can judge it.
    def needs_review(reason)
      entry = @entry.is_a?(Hash)
      identity.merge(
        assessment_status:  'needs_review',
        status_reason:      reason,
        ai_level:           nil,
        ai_confidence:      confidence,
        evidence:           entry ? evidence : [],
        competency_summary: entry ? summary : ''
      )
    end

    def confidence
      Coverage::Confidence.for(state: @coverage.state, probe_count: @coverage.probe_count)
    end

    def parse_level(raw)
      case raw
      when Integer then raw.between?(1, 5) ? raw : nil
      when Float   then raw == raw.floor ? parse_level(raw.to_i) : nil
      when String  then raw[LEVEL_PATTERN, 1]&.to_i
      end
    end

    def evidence
      raw = @entry['evidence']
      raw = [raw] if raw.is_a?(String)
      return [] unless raw.is_a?(Array)

      raw.grep(String).map(&:strip).reject(&:empty?).uniq.first(MAX_QUOTES).map { |q| q[0, MAX_QUOTE_LENGTH] }
    end

    def summary
      raw = @entry['competency_summary']
      raw.is_a?(String) ? raw.strip[0, MAX_SUMMARY_LENGTH] : ''
    end
  end
end
