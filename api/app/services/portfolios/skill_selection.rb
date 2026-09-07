# frozen_string_literal: true

module Portfolios
  # Decides which skills from a Gemini portfolio response may be persisted.
  #
  # Kept separate from Portfolios::Generator (which owns the Gemini call and the
  # database writes) so the rule that closes the P0 — "no score without a
  # discussion" — is a pure function that can be tested in isolation.
  #
  # Rules, in order:
  #   1. drop entries that fail validation (no label, no numeric level, no summary)
  #   2. drop entries whose coverage state is `not_yet` (never discussed)
  #   3. collapse duplicates, last occurrence wins
  class SkillSelection
    Result = Struct.new(:skills, :skipped, keyword_init: true) do
      def skipped_labels
        skipped.map { |entry| entry[:skill_label] }
      end
    end

    def self.call(data, coverage_maps:)
      new(data, coverage_maps: coverage_maps).call
    end

    def initialize(data, coverage_maps:)
      @data   = data.is_a?(Hash) ? data : {}
      @lookup = CoverageLookup.new(coverage_maps)
    end

    def call
      kept    = {}
      skipped = []

      payloads.each do |payload|
        unless payload.valid?
          skipped << skip_entry(payload, payload.rejection_reason)
          next
        end

        unless @lookup.discussed?(skill_id: payload.skill_id, skill_label: payload.skill_label)
          skipped << skip_entry(payload, :not_discussed)
          next
        end

        kept[payload.dedup_key] = payload
      end

      Result.new(skills: kept.values, skipped: skipped)
    end

    private

    def payloads
      configured = Array(@data['configured_skills']).map { |raw| SkillPayload.parse(raw, discovered: false) }
      discovered = Array(@data['discovered_skills']).map  { |raw| SkillPayload.parse(raw, discovered: true) }
      configured + discovered
    end

    def skip_entry(payload, reason)
      {
        skill_id:    payload.skill_id,
        skill_label: payload.skill_label,
        reason:      reason
      }
    end
  end
end
