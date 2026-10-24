# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  # A failed request is visible to the assessor and retried explicitly. Sidekiq
  # automatic retries would otherwise obscure the terminal state and duplicate work.
  sidekiq_options queue: :default, retry: false

  def perform(portfolio_id, vacancy_id, request_token)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.where(tenant_id: portfolio.session.tenant_id).find(vacancy_id)
    request = FitGapGenerationRequest.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
    return unless request&.request_token == request_token

    request.with_lock do
      return unless request.request_token == request_token && request.status == 'queued'

      request.update!(status: 'running', error_code: nil)
    end

    attributes = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).build

    request.with_lock do
      return unless request.request_token == request_token && request.status == 'running'
      unless FitGap::SourceDigest.call(portfolio: portfolio, vacancy: vacancy) == request.source_digest
        request.update!(status: 'failed', error_code: 'SourceChanged')
        return
      end

      FitGapReport.transaction do
        report = FitGapReport.find_or_initialize_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        report.update!(attributes.merge(source_digest: request.source_digest))
        request.update!(status: 'succeeded', error_code: nil)
      end
    end

  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N13] Record not found for portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
  rescue StandardError => e
    request&.with_lock do
      request.update!(status: 'failed', error_code: e.class.name) if request.request_token == request_token
    end
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}")
  end
end
