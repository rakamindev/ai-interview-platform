# frozen_string_literal: true

require 'json'

module Portfolios
  # Decides which model rows become portfolio skills and which are omitted.
  # Parsing happens before any delete, so a bad payload cannot wipe a
  # portfolio that was already reviewed.
  class SkillPlan
    Row = Struct.new(
      :skill_id, :skill_label, :is_discovered, :level, :confidence,
      :evidence, :competency_summary, :match_key,
      keyword_init: true
    )
    Omission = Struct.new(:skill_label, :skill_id, :is_discovered, :reason, keyword_init: true)
    Plan = Struct.new(:rows, :omissions, keyword_init: true)

    def self.parse_payload(response)
      return response if response.is_a?(Hash)

      text = response.to_s.strip
      text = text.sub(/\A```(?:json)?\s*/i, '').sub(/\s*```\z/, '')
      JSON.parse(text)
    end

    def self.build(payload)
      data = payload.is_a?(Hash) ? payload : {}
      rows = []
      omissions = []

      Array(data['configured_skills'] || data[:configured_skills]).each do |raw|
        place(raw, discovered: false, rows: rows, omissions: omissions)
      end
      Array(data['discovered_skills'] || data[:discovered_skills]).each do |raw|
        place(raw, discovered: true, rows: rows, omissions: omissions)
      end

      Plan.new(rows: rows, omissions: omissions)
    end

    def self.place(raw, discovered:, rows:, omissions:)
      item = stringify(raw)
      label = item['skill_label'].is_a?(String) ? item['skill_label'].strip : ''
      skill_id = item['skill_id'].is_a?(String) ? item['skill_id'].strip : nil
      skill_id = nil if skill_id.to_s.empty?

      if label.empty?
        omissions << Omission.new(skill_label: nil, skill_id: skill_id, is_discovered: discovered, reason: 'missing_label')
        return
      end

      rating = RatingNormalizer.call(level: item['level'], confidence: item['confidence'])
      unless rating.persistable
        omissions << Omission.new(skill_label: label, skill_id: skill_id, is_discovered: discovered, reason: rating.rejection_reason)
        return
      end

      summary = item['competency_summary'].is_a?(String) ? item['competency_summary'].strip : ''
      summary = 'Evidence was too thin to summarize a competency pattern.' if summary.empty?

      rows << Row.new(
        skill_id: skill_id,
        skill_label: label,
        is_discovered: discovered,
        level: rating.level,
        confidence: rating.confidence,
        evidence: Array(item['evidence']).filter_map { |quote| quote.is_a?(String) ? quote.strip : nil }.reject(&:empty?).first(3),
        competency_summary: summary,
        match_key: match_key(skill_id, label)
      )
    end

    def self.match_key(skill_id, label)
      return "id:#{skill_id}" if skill_id.to_s.strip != ''

      "label:#{label.to_s.strip.downcase}"
    end

    def self.stringify(raw)
      return {} unless raw.is_a?(Hash)

      raw.each_with_object({}) do |(key, value), memo|
        memo[key.to_s] = value
      end
    end
    private_class_method :place, :stringify
  end
end
