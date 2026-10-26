# frozen_string_literal: true

module FitGap
  # Single source of truth for the fit/gap JSON contract consumed by the web
  # app and the JSON export. Normalises rows written before the lifecycle
  # migration so the UI never has to guess missing keys.
  class ReportPresenter
    ROW_DEFAULTS = {
      'skill_id' => nil, 'expected_level' => nil, 'candidate_level' => nil, 'ai_level' => nil,
      'is_override' => false, 'assessor_notes' => nil, 'confidence' => nil,
      'needs_verification' => false, 'delta' => nil, 'not_assessed_reason' => nil
    }.freeze

    FAILED_MESSAGE = 'We could not generate this report. Please try again.'

    def initialize(report, current_digest: nil)
      @report = report
      @current_digest = current_digest
    end

    def as_json(*)
      rows = comparisons
      {
        id: @report.id,
        portfolio_id: @report.portfolio_id,
        vacancy_id: @report.vacancy_id,
        status: @report.status,
        stale: stale?,
        error_message: @report.failed? ? (@report.error_message.presence || FAILED_MESSAGE) : nil,
        narrative_source: @report.narrative_source,
        generated_at: @report.generated_at,
        summary: summary(rows),
        skill_comparisons: rows,
        culture_narrative: @report.culture_narrative,
        overall_narrative: @report.overall_narrative
      }
    end

    private

    # Outdated = there is a previous result and its inputs no longer match.
    def stale?
      return false if @current_digest.nil? || Array(@report.skill_comparisons).empty?

      @report.inputs_digest != @current_digest
    end

    def comparisons
      Array(@report.skill_comparisons).map do |row|
        ROW_DEFAULTS.merge(row.to_h.stringify_keys).tap do |normalized|
          normalized['result'] = 'not_assessed' unless Comparator::RESULTS.include?(normalized['result'])
        end
      end
    end

    def summary(rows)
      counts = Comparator::RESULTS.to_h { |result| [result, rows.count { |r| r['result'] == result }] }
      { total: rows.size, **counts.symbolize_keys, needs_verification: rows.count { |r| r['needs_verification'] } }
    end
  end
end
