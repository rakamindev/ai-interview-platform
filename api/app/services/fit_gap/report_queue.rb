# frozen_string_literal: true

module FitGap
  class ReportQueue
    def initialize(portfolio:, vacancy:)
      @portfolio = portfolio
      @vacancy = vacancy
    end

    def call(force: false)
      enqueue = false
      report = nil
      attempt_token = SecureRandom.uuid

      @portfolio.with_lock do
        report = FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
        if report.nil?
          report = FitGapReport.create!(
            portfolio_id: @portfolio.id,
            vacancy_id: @vacancy.id,
            skill_comparisons: [],
            generated_at: nil,
            generation_started_at: nil,
            generation_token: attempt_token,
            generation_status: "pending"
          )
          enqueue = true
        elsif report.generation_status == "failed" || force
          report.update!(
            generation_status: "pending",
            generation_started_at: nil,
            generation_token: attempt_token
          )
          enqueue = true
        end
      end

      if enqueue
        begin
          unless FitGapGeneratorWorker.perform_async(@portfolio.id, @vacancy.id, attempt_token)
            raise "Fit/gap job could not be queued"
          end
        rescue StandardError
          FitGapReport.where(id: report.id, generation_token: attempt_token)
                      .where(generation_status: "pending")
                      .update_all(
                        generation_status: "failed",
                        generation_started_at: nil,
                        generation_token: nil
                      )
          raise
        end
      end

      report
    end
  end
end
