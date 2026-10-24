# frozen_string_literal: true

module FitGap
  # Converts role requirements and interview evidence into deterministic comparisons.
  # AI prose is deliberately excluded from this decision boundary.
  class ComparisonBuilder
    def initialize(vacancy_skills:, portfolio_skills:, coverage_maps:, candidate_turns:)
      @vacancy_skills = vacancy_skills.to_a
      @portfolio_skills = portfolio_skills.to_a
      @coverage_maps = coverage_maps.to_a
      @candidate_turns = candidate_turns.map { |text| normalize(text) }
    end

    def call
      validate_uniqueness!(@vacancy_skills, 'vacancy')
      validate_uniqueness!(@portfolio_skills, 'portfolio')

      @vacancy_skills.map do |requirement|
        skill = find_skill(requirement)
        build_comparison(requirement, skill)
      end
    end

    private

    def normalize(value)
      value.to_s.gsub(/[“”"']/, '').squish.downcase
    end

    def normalized_id(skill)
      skill.skill_id.to_s.strip.upcase.presence
    end

    def validate_uniqueness!(skills, source)
      ids = skills.filter_map { |skill| normalized_id(skill) }
      labels = skills.map { |skill| normalize(skill.skill_label) }
      if ids.uniq.length != ids.length || labels.any?(&:blank?) || labels.uniq.length != labels.length
        raise ArgumentError, "Duplicate or blank #{source} skill identity"
      end
    end

    def find_skill(requirement)
      id = normalized_id(requirement)
      by_id = @portfolio_skills.find { |skill| normalized_id(skill) == id } if id
      if by_id
        raise ArgumentError, 'Conflicting skill ID and label' if normalize(by_id.skill_label) != normalize(requirement.skill_label)
        return by_id
      end

      by_label = @portfolio_skills.find { |skill| normalize(skill.skill_label) == normalize(requirement.skill_label) }
      if by_label && id && normalized_id(by_label) && normalized_id(by_label) != id
        raise ArgumentError, 'Conflicting skill ID and label'
      end

      by_label
    end

    def coverage_for(requirement)
      id = normalized_id(requirement)
      @coverage_maps.find { |map| id && normalized_id(map) == id } ||
        @coverage_maps.find { |map| normalize(map.skill_label) == normalize(requirement.skill_label) }
    end

    def build_comparison(requirement, skill)
      base = {
        skill_id: requirement.skill_id,
        skill_label: requirement.skill_label,
        required_level: requirement.expected_level,
        candidate_level: nil,
        ai_level: skill&.ai_level,
        delta: nil,
        result: 'not_assessed',
        assessment_state: 'not_assessed',
        confidence: skill&.ai_confidence,
        evidence_count: 0,
        portfolio_skill_id: skill&.id,
        is_override: skill&.assessor_override.present? || false
      }
      return base.merge(reason: 'No matching portfolio skill') unless skill

      level = skill.assessor_override&.override_level || skill.ai_level
      return base.merge(reason: 'Invalid candidate level') unless level.is_a?(Integer) && (1..5).cover?(level)

      verified = Portfolios::EvidenceVerifier.verified_count(skill.evidence_quotes, @candidate_turns)
      base[:evidence_count] = verified

      coverage = coverage_for(requirement)
      if verified < 2 || coverage.nil? || coverage.probe_count.to_i < 2 ||
         !%w[partial covered].include?(coverage.state) || skill.ai_confidence == 'low'
        return base.merge(assessment_state: 'insufficient_evidence',
                          reason: 'Fewer than two substantive quotes from distinct candidate turns or insufficient probing')
      end

      delta = level - requirement.expected_level
      base.merge(
        candidate_level: level,
        delta: delta,
        result: delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap'),
        assessment_state: 'assessed',
        reason: nil
      )
    end
  end
end
