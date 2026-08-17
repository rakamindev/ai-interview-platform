# frozen_string_literal: true

module Portfolios
  class Presenter
    CONFIDENCE = %w[high medium low].freeze
    PARTIAL_COVERAGE = %w[initiated partial].freeze

    SkillView = Struct.new(
      :skill_id, :skill_label, :state, :effective_level, :ai_level, :ai_confidence,
      :coverage_state, :probe_count, :evidence, :competency_summary, :expected_level,
      :is_discovered, :override,
      keyword_init: true
    )

    def initialize(session:)
      @session = session
    end

    def call
      views = skill_views
      {
        skills:            views,
        summary:           summarize(views),
        generation_status: portfolio&.generation_status,
        generation_error:  portfolio&.generation_error
      }
    end

    private

    def portfolio
      return @portfolio if defined?(@portfolio)

      @portfolio = @session.portfolio
    end

    def portfolio_skills
      @portfolio_skills ||= portfolio ? portfolio.portfolio_skills.to_a : []
    end

    def coverage_maps
      @coverage_maps ||= @session.coverage_maps.to_a
    end

    def plan_skills
      @plan_skills ||= @session.assessment.assessment_skills.order(:display_order).to_a
    end

    def skill_views
      @skill_views ||= begin
        seen  = {}
        views = []

        plan_skills.each do |plan|
          key = dedupe_key(plan.skill_id, plan.skill_label)
          next if seen[key]

          seen[key] = true
          views << build_view(
            skill_id:       plan.skill_id,
            skill_label:    plan.skill_label,
            expected_level: plan.expected_level,
            coverage:       lookup(coverage_maps, plan.skill_id, plan.skill_label),
            ps:             lookup(portfolio_skills, plan.skill_id, plan.skill_label),
            discovered:     false
          )
        end

        (coverage_maps.select(&:is_discovered) + portfolio_skills.select(&:is_discovered)).each do |rec|
          key = dedupe_key(rec.skill_id, rec.skill_label)
          next if seen[key]

          seen[key] = true
          views << build_view(
            skill_id:       rec.skill_id,
            skill_label:    rec.skill_label,
            expected_level: nil,
            coverage:       lookup(coverage_maps, rec.skill_id, rec.skill_label),
            ps:             lookup(portfolio_skills, rec.skill_id, rec.skill_label),
            discovered:     true
          )
        end

        views
      end
    end

    def dedupe_key(skill_id, skill_label)
      skill_id.presence || skill_label
    end

    def lookup(records, skill_id, skill_label)
      if skill_id.present?
        by_id = records.find { |r| r.skill_id == skill_id }
        return by_id if by_id
      end
      records.find { |r| r.skill_label == skill_label }
    end

    def build_view(skill_id:, skill_label:, expected_level:, coverage:, ps:, discovered:)
      state = derive_state(coverage: coverage, ps: ps, discovered: discovered)

      SkillView.new(
        skill_id:           skill_id,
        skill_label:        skill_label,
        state:              state,
        effective_level:    effective_level(state: state, ps: ps),
        ai_level:           ps && clamp_level(ps.ai_level),
        ai_confidence:      ps && confidence(ps.ai_confidence),
        coverage_state:     coverage&.state || 'not_yet',
        probe_count:        coverage&.probe_count || 0,
        evidence:           evidence_for(ps),
        competency_summary: ps&.competency_summary.presence,
        expected_level:     expected_level,
        is_discovered:      discovered,
        override:           override_for(ps)
      )
    end

    def derive_state(coverage:, ps:, discovered:)
      return 'discovered' if discovered

      probes    = coverage&.probe_count.to_i
      cov_state = coverage&.state

      return 'not_assessed' if coverage.nil? || cov_state == 'not_yet' || probes.zero? || ps.nil?
      if PARTIAL_COVERAGE.include?(cov_state) || probes <= 1 || confidence(ps.ai_confidence) == 'low'
        return 'partially_assessed'
      end

      'assessed'
    end

    def effective_level(state:, ps:)
      return nil if state == 'not_assessed'
      return ps.assessor_override.override_level if ps&.assessor_override

      ps && clamp_level(ps.ai_level)
    end

    def clamp_level(level)
      return nil if level.nil?

      level.to_i.clamp(1, 5)
    end

    def confidence(value)
      CONFIDENCE.include?(value) ? value : 'low'
    end

    def evidence_for(ps)
      return [] unless ps

      Array(ps.evidence).select { |e| e.is_a?(String) && e.strip.present? }.first(3)
    end

    def override_for(ps)
      ovr = ps&.assessor_override
      return nil unless ovr

      { level: ovr.override_level, reason: ovr.assessor_notes, by: ovr.overridden_by, at: ovr.overridden_at }
    end

    def summarize(views)
      counts = views.group_by(&:state).transform_values(&:size)
      {
        assessed:           counts.fetch('assessed', 0),
        partially_assessed: counts.fetch('partially_assessed', 0),
        not_assessed:       counts.fetch('not_assessed', 0),
        discovered:         counts.fetch('discovered', 0),
        total:              views.size
      }
    end
  end
end
