# frozen_string_literal: true

module Portfolios
  # Turns the skill list returned by the model into rows that are safe to persist.
  #
  # Rule: never fabricate a level.
  #  - A configured skill the interview never reached (coverage state "not_yet")
  #    gets no row, so the fit/gap engine reports it as "not_assessed" instead of
  #    a forced L1.
  #  - A row whose level is missing or outside 1..5 is dropped for the same
  #    reason, rather than silently clamped.
  class SkillRows
    CONFIDENCES      = %w[high medium low].freeze
    UNREACHED_STATES = %w[not_yet].freeze

    # items:           skills as returned by the model (array of string-keyed hashes)
    # coverage_states: { skill_id or downcased label => coverage state }
    # discovered:      true for skills outside the configured assessment
    def self.call(items, coverage_states: {}, discovered: false)
      new(items, coverage_states, discovered).call
    end

    # Configured skill labels that ended up with no row (the "not assessed" list).
    def self.not_assessed(configured_labels, assessed_labels)
      assessed = Array(assessed_labels).map { |label| label.to_s.downcase }
      Array(configured_labels).reject { |label| assessed.include?(label.to_s.downcase) }
    end

    def initialize(items, coverage_states, discovered)
      @items     = Array(items)
      @states    = coverage_states || {}
      @discovered = discovered
    end

    def call
      @items.filter_map { |item| build_row(item) }
    end

    private

    def build_row(item)
      return unless item.is_a?(Hash)

      label = item['skill_label'].to_s.strip
      return if label.empty?

      skill_id = item['skill_id'].to_s.strip
      skill_id = nil if skill_id.empty?
      return if !@discovered && unreached?(skill_id, label)

      level = parse_level(item['level'])
      return if level.nil?

      {
        skill_id:           @discovered ? nil : skill_id,
        skill_label:        label,
        is_discovered:      @discovered,
        ai_level:           level,
        ai_confidence:      normalize_confidence(item['confidence']),
        evidence:           Array(item['evidence']).map { |quote| quote.to_s.strip }.reject(&:empty?).first(3),
        competency_summary: item['competency_summary']
      }
    end

    def unreached?(skill_id, label)
      state = @states[skill_id.to_s] || @states[label.downcase]
      UNREACHED_STATES.include?(state)
    end

    def parse_level(value)
      number = value.is_a?(Numeric) ? value : Integer(value.to_s.strip.delete_prefix('L'), exception: false)
      return unless number.is_a?(Numeric) && number == number.to_i

      number = number.to_i
      number if (1..5).cover?(number)
    end

    def normalize_confidence(value)
      confidence = value.to_s.strip.downcase
      CONFIDENCES.include?(confidence) ? confidence : 'low'
    end
  end
end
