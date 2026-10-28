# frozen_string_literal: true

module FitGap
  # The JSON shape of a fit/gap report, shared with the web app through
  # contracts/fit_gap_report.example.json. Reports stored by older engine versions lack some row
  # keys, so every row is filled to the full shape here.
  class ReportSerializer
    ROW_DEFAULTS = {
      'skill_label' => nil, 'skill_id' => nil, 'expected_level' => nil, 'candidate_level' => nil,
      'ai_level' => nil, 'result' => 'not_assessed', 'delta' => nil, 'confidence' => nil,
      'provisional' => false, 'overridden' => false, 'assessment_status' => nil
    }.freeze

    def self.call(report, generating: false)
      new(report, generating).call
    end

    def initialize(report, generating)
      @report     = report
      @generating = generating
    end

    def call
      {
        id:                @report.id,
        portfolio_id:      @report.portfolio_id,
        vacancy_id:        @report.vacancy_id,
        skill_comparisons: Array(@report.skill_comparisons).map { |row| ROW_DEFAULTS.merge(row.slice(*ROW_DEFAULTS.keys)) },
        culture_narrative: @report.culture_narrative,
        overall_narrative: @report.overall_narrative,
        generated_at:      @report.generated_at,
        stale:             @report.rules_version < Engine::RULES_VERSION,
        outdated:          overridden_since_generated?,
        generating:        @generating
      }
    end

    private

    def overridden_since_generated?
      AssessorOverride.joins(:portfolio_skill)
                      .where(portfolio_skills: { portfolio_id: @report.portfolio_id })
                      .where('assessor_overrides.overridden_at > ?', @report.generated_at)
                      .exists?
    end
  end
end
