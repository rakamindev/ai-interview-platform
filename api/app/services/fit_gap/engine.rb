# frozen_string_literal: true

module FitGap
  # Comparisons are deterministic. No model call is needed to subtract levels;
  # skill levels alone do not support a culture-fit or hiring recommendation.
  class Engine
    def initialize(portfolio:, vacancy:, **_options)
      @portfolio = portfolio
      @vacancy = vacancy
    end

    def call
      raise ActiveRecord::RecordNotFound unless @portfolio.session.tenant_id == @vacancy.tenant_id

      # Serialize with regeneration and overrides. No external I/O in this transaction.
      @portfolio.with_lock do
        raise ArgumentError, 'Portfolio is not ready' unless @portfolio.complete?
        @vacancy.with_lock do
          comparisons = build_skill_comparisons
          report = FitGapReport.find_or_initialize_by(portfolio: @portfolio, vacancy: @vacancy)
          report.assign_attributes(skill_comparisons: comparisons, culture_narrative: nil,
                                   overall_narrative: summary(comparisons))
          report.generated_at = Time.current if report.changed? || report.new_record?
          report.save! if report.changed? || report.new_record?
          report
        end
      end
    end

    private

    def build_skill_comparisons
      skills = @portfolio.portfolio_skills.includes(:assessor_override).to_a
      by_id = skills.select { |s| s.skill_id.present? }.group_by(&:skill_id)
      by_label = skills.group_by { |s| s.skill_label.strip.downcase }
      @vacancy.vacancy_skills.order(:id).map do |required|
        # A canonical ID must never silently match a different taxonomy ID by label.
        matches = by_label.fetch(required.skill_label.strip.downcase, [])
        matches = by_id.fetch(required.skill_id, []) if required.skill_id.present?
        skill = matches.one? ? matches.first : nil
        override = skill&.assessor_override
        level = override ? override.override_level : skill&.ai_level
        delta = level && level - required.expected_level
        result = delta.nil? ? 'not_assessed' : (delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap'))
        {
          skill_id: required.skill_id, skill_label: required.skill_label,
          expected_level: required.expected_level, candidate_level: level,
          result: result, delta: delta, is_override: override.present?,
          confidence: skill&.ai_confidence
        }
      end
    end

    def summary(comparisons)
      counts = comparisons.map { |c| c[:result] }.tally
      "#{counts.fetch('match', 0)} match, #{counts.fetch('exceed', 0)} exceed, " \
        "#{counts.fetch('gap', 0)} gap, #{counts.fetch('not_assessed', 0)} not assessed. " \
        'Unassessed skills are not skill gaps. Review interview evidence before making a hiring decision.'
    end
  end
end
