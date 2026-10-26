# frozen_string_literal: true

module FitGap
  # N13: Computes a fit/gap report for a claimed FitGapReport row.
  #
  # Rule-based comparison (FitGap::Comparator) decides every outcome; the model
  # only writes prose around it (FitGap::Narrator) and can fail without failing
  # the report. All report fields are written in one statement so a reader
  # never sees comparisons from one run and narrative from another.
  class Engine
    def initialize(report:, narrator: nil)
      @report = report
      @inputs = Inputs.new(portfolio: report.portfolio, vacancy: report.vacancy)
      @narrator = narrator || Narrator.new(inputs: @inputs)
    end

    # Returns the completed FitGapReport.
    def call
      result = Comparator.new(requirements: @inputs.requirements, ratings: @inputs.ratings).call
      narrative = @narrator.call(result)

      @report.update!(
        status: 'complete',
        skill_comparisons: result.comparisons,
        culture_narrative: narrative.culture,
        overall_narrative: narrative.overall,
        narrative_source: narrative.source,
        inputs_digest: @inputs.digest,
        error_message: nil,
        generated_at: Time.current
      )

      Rails.logger.info("[N13] Fit/gap report generated: report=#{@report.id} narrative=#{narrative.source}")
      @report
    end
  end
end
