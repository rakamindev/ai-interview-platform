# frozen_string_literal: true

module FitGap
  # One durable generation request per portfolio/vacancy pair. Repeated calls do
  # not enqueue duplicate work, while the previous successful report stays intact.
  class GenerationManager
    class EnqueueError < StandardError; end

    QUEUED_TIMEOUT = 2.minutes
    RUNNING_TIMEOUT = 5.minutes

    def initialize(portfolio:, vacancy:)
      @portfolio = portfolio
      @vacancy = vacancy
      raise ArgumentError, 'Cross-tenant fit/gap request' if portfolio.session.tenant_id != vacancy.tenant_id
    end

    def queue(force: false)
      digest = source_digest
      report = current_report
      return state if !force && report&.source_digest == digest

      request, created = find_or_create_request(digest)
      expire_stalled_request!(request) unless created
      enqueue = false

      request.with_lock do
        if created
          enqueue = true
        elsif %w[queued running].include?(request.status) && request.source_digest == digest
          enqueue = false
        elsif !force && report&.source_digest == digest
          enqueue = false
        else
          request.update!(status: 'queued', request_token: SecureRandom.hex(24),
                          source_digest: digest, error_code: nil)
          enqueue = true
        end
      end

      if enqueue
        request_token = request.request_token
        begin
          job_id = FitGapGeneratorWorker.perform_async(@portfolio.id, @vacancy.id, request_token)
          raise EnqueueError, 'No job ID returned' if job_id.blank?
        rescue StandardError
          request.with_lock do
            if request.status == 'queued' && request.request_token == request_token
              request.update!(status: 'failed', error_code: 'EnqueueFailed')
            end
          end
          raise EnqueueError, 'Could not queue fit/gap generation'
        end
      end

      state
    end

    def state
      report = current_report
      request = FitGapGenerationRequest.find_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
      expire_stalled_request!(request) if request
      digest = source_digest

      {
        report: report,
        stale: report.present? && report.source_digest != digest,
        generation: request && {
          status: request.status,
          error_code: request.error_code,
          requested_at: request.created_at,
          updated_at: request.updated_at
        }
      }
    end

    private

    def source_digest
      FitGap::SourceDigest.call(portfolio: @portfolio, vacancy: @vacancy)
    end

    def current_report
      FitGapReport.find_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
    end

    def find_or_create_request(digest)
      request = FitGapGenerationRequest.find_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
      return [request, false] if request

      request = FitGapGenerationRequest.create!(portfolio: @portfolio, vacancy: @vacancy,
                                                request_token: SecureRandom.hex(24),
                                                source_digest: digest, status: 'queued')
      [request, true]
    rescue ActiveRecord::RecordNotUnique
      [FitGapGenerationRequest.find_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id), false]
    end

    def expire_stalled_request!(request)
      request.with_lock do
        timeout = case request.status
                  when 'queued' then QUEUED_TIMEOUT
                  when 'running' then RUNNING_TIMEOUT
                  end
        next unless timeout && request.updated_at < Time.current - timeout

        request.update!(status: 'failed', error_code: 'GenerationTimedOut')
      end
    end
  end
end
