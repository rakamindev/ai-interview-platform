# frozen_string_literal: true

module FitGap
  class Generation
    def self.enqueue(portfolio:, vacancy:, force: false)
      should_enqueue = false
      report = FitGapReport.find_or_create_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id) do |record|
        record.skill_comparisons = []
        record.generation_status = 'failed'
        record.generated_at = nil
      end
      report.with_lock do
        if report.failed? || (force && !report.generating?)
          report.update!(generation_status: 'generating', generation_error: nil,
                         generation_token: SecureRandom.uuid)
          should_enqueue = true
        end
      end
      FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id, report.generation_token) if should_enqueue
      report.reload
    rescue ActiveRecord::RecordNotUnique
      retry
    rescue StandardError
      report&.update(generation_status: 'failed', generation_error: 'enqueue_failed') if should_enqueue
      raise
    end
  end
end
