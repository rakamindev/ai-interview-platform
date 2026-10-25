require 'digest'

module FitGap
  class Snapshot
    VERSION = 1
    attr_reader :requirements, :ratings

    def initialize(portfolio:, vacancy:)
      @requirements = vacancy.vacancy_skills.order(:id).map do |skill|
        { requirement_id: skill.id, skill_id: skill.skill_id, skill_label: skill.skill_label, expected_level: skill.expected_level }
      end
      @ratings = portfolio.portfolio_skills.includes(:assessor_override).order(:id).map do |skill|
        override = skill.assessor_override
        { portfolio_skill_id: skill.id, skill_id: skill.skill_id, skill_label: skill.skill_label,
          ai_level: self.class.level(override ? override.ai_level : skill.ai_level), candidate_level: self.class.level(override ? override.override_level : skill.ai_level),
          confidence: skill.ai_confidence, rating_source: override ? 'assessor' : 'ai',
          evidence: skill.evidence_quotes.select { |quote| quote.is_a?(String) }.first(3),
          competency_summary: skill.competency_summary, assessor_notes: override&.assessor_notes,
          overridden_at: override&.overridden_at&.iso8601(6) }
      end
    end

    def digest
      Digest::SHA256.hexdigest(JSON.generate(version: VERSION, requirements: requirements, ratings: ratings))
    end

    def self.level(value)
      return value if value.is_a?(Integer) && (1..5).cover?(value)
      return value.to_i if value.is_a?(String) && value.match?(/\A[1-5]\z/)
      nil
    end

    def self.normalize(value)
      value.to_s.strip.downcase.gsub(/\s+/, ' ')
    end

    def rating_for(requirement)
      candidates = if requirement[:skill_id].present?
        ratings.select { |rating| self.class.normalize(rating[:skill_id]) == self.class.normalize(requirement[:skill_id]) }
      else
        ratings.select { |rating| rating[:skill_id].blank? && self.class.normalize(rating[:skill_label]) == self.class.normalize(requirement[:skill_label]) }
      end
      candidates.one? ? candidates.first : nil
    end
  end
end
