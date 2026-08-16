# frozen_string_literal: true

module FitGap
  # Persists deterministic comparison immediately and schedules narrative work.
  class ReportCoordinator
    def initialize(portfolio:, vacancy:, enqueue: true)
      @portfolio = portfolio
      @vacancy = vacancy
      @enqueue = enqueue
    end

    def call
      validate_tenant_boundary!

      comparison = ComparisonBuilder.new(
        portfolio: @portfolio,
        vacancy: @vacancy
      ).call

      report = FitGapReport.transaction do
        report = FitGapReport.find_or_initialize_by(
          portfolio_id: @portfolio.id,
          vacancy_id: @vacancy.id
        )

        report.update!(
          skill_comparisons: comparison[:skill_comparisons],
          culture_narrative: nil,
          overall_narrative: nil,
          narrative_status: "pending",
          narrative_error: nil,
          narrative_generated_at: nil,
          narrative_generation: report.narrative_generation.to_i + 1,
          generated_at: Time.current
        )

        report
      end

      enqueue_narrative(report) if @enqueue
      report
    end

    private

    def validate_tenant_boundary!
      return if @portfolio.session.tenant_id == @vacancy.tenant_id

      raise ActiveRecord::RecordNotFound, "Fit/gap report not found"
    end

    def enqueue_narrative(report)
      FitGapGeneratorWorker.perform_async(report.id, report.narrative_generation)
    end
  end
end
