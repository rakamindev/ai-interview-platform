# frozen_string_literal: true

module FitGap
  class Engine
    def initialize(portfolio:, vacancy:)
      @portfolio = portfolio
      @vacancy = vacancy
    end

    def call
      raise ActiveRecord::RecordNotFound unless @portfolio.session.tenant_id == @vacancy.tenant_id
      raise ArgumentError, 'Portfolio must be complete' unless @portfolio.complete?

      @portfolio.with_lock do
        snapshot = Snapshot.new(portfolio: @portfolio, vacancy: @vacancy)
        comparisons = snapshot.requirements.map do |requirement|
          rating = snapshot.rating_for(requirement)
          level = rating&.fetch(:candidate_level)
          expected = Snapshot.level(requirement[:expected_level])
          delta = level && expected ? level - expected : nil
          result = if delta.nil? then 'not_assessed'
                   elsif delta.zero? then 'match'
                   elsif delta.positive? then 'exceed'
                   else 'gap'
                   end
          requirement.merge(rating || {}).merge(
            skill_id: requirement[:skill_id], skill_label: requirement[:skill_label],
            candidate_level: delta.nil? ? nil : level, expected_level: expected,
            delta: delta, result: result, rating_source: delta.nil? ? 'none' : rating[:rating_source],
            confidence: rating&.fetch(:confidence), ai_level: rating&.fetch(:ai_level),
            is_override: !delta.nil? && rating[:rating_source] == 'assessor'
          )
        end

        counts = comparisons.group_by { |comparison| comparison[:result] }.transform_values(&:length)
        summary = "#{counts.fetch('match', 0)} match, #{counts.fetch('exceed', 0)} exceed, " \
          "#{counts.fetch('gap', 0)} gap, and #{counts.fetch('not_assessed', 0)} not assessed. " \
          'Missing evidence is not a skill deficit. Review supporting evidence and follow up before making a hiring decision.'

        report = FitGapReport.find_or_initialize_by(portfolio: @portfolio, vacancy: @vacancy)
        report.update!(skill_comparisons: comparisons, culture_narrative: nil, overall_narrative: summary,
          generation_status: 'complete', source_digest: snapshot.digest, generated_at: Time.current, error_code: nil)
        report
      end
    end
  end
end
