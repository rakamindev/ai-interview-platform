module FitGap
  class RequestGeneration
    def self.call(portfolio:, vacancy:, force: false)
      raise ActiveRecord::RecordNotFound unless portfolio.session.tenant_id == vacancy.tenant_id
      queued = false
      report = nil
      portfolio.with_lock do
        report = FitGapReport.find_or_initialize_by(portfolio: portfolio, vacancy: vacancy)
        active = report.persisted? && %w[pending generating].include?(report.review_status)
        reusable = report.persisted? && %w[complete failed].include?(report.review_status) && !force
        unless active || reusable
          report.assign_attributes(generation_status: 'pending', requested_at: Time.current,
            generation_token: SecureRandom.uuid, error_code: nil)
          report.generated_at = nil if report.new_record?
          report.save!
          queued = true
        end
      end

      if queued
        begin
          FitGapGeneratorWorker.perform_async(report.id, report.generation_token, portfolio.session.tenant_id)
        rescue StandardError => error
          FitGapReport.where(id: report.id, generation_token: report.generation_token)
            .update_all(generation_status: 'failed', error_code: 'queue_unavailable')
          Rails.logger.warn("Fit/gap queue unavailable report=#{report.id} error_class=#{error.class}")
          report.reload
        end
      end
      report
    end
  end
end
