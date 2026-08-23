# frozen_string_literal: true

class FitGapReportSerializer
  def initialize(report)
    @report = report
  end

  def as_json(**)
    {
      id:                report.id,
      portfolio_id:      report.portfolio_id,
      vacancy_id:        report.vacancy_id,
      skill_comparisons: report.skill_comparisons,
      culture_narrative: report.culture_narrative,
      overall_narrative: report.overall_narrative,
      generated_at:      report.generated_at
    }
  end

  private

  attr_reader :report
end
