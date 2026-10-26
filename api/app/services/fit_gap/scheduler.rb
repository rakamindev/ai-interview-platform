# frozen_string_literal: true

module FitGap
  # The only way a fit/gap generation is requested. Idempotent: concurrent or
  # repeated requests (double clicks, polling pages, override bursts) collapse
  # into at most one queued job per portfolio×vacancy, and an up-to-date
  # report is never regenerated unless forced.
  class Scheduler
    def self.request(portfolio:, vacancy:, force: false)
      new(portfolio:, vacancy:, force:).call
    end

    def initialize(portfolio:, vacancy:, force: false)
      @portfolio = portfolio
      @vacancy = vacancy
      @force = force
    end

    # Returns the (possibly newly created) report.
    def call
      report = find_or_create_report
      enqueue = report.with_lock { mark_pending_if_needed(report) }
      FitGapGeneratorWorker.perform_async(@portfolio.id, @vacancy.id) if enqueue
      report
    end

    private

    def mark_pending_if_needed(report)
      return false if alive_in_flight?(report)
      return false if report.complete? && !@force && up_to_date?(report)

      report.update!(status: 'pending', error_message: nil, queued_at: Time.current, generation_started_at: nil)
      true
    end

    def alive_in_flight?(report)
      case report.status
      when 'pending'    then !report.queue_lease_expired?
      when 'generating' then !report.generation_lease_expired?
      else false
      end
    end

    def up_to_date?(report)
      report.inputs_digest.present? &&
        report.inputs_digest == Inputs.new(portfolio: @portfolio, vacancy: @vacancy).digest
    end

    def find_or_create_report
      FitGapReport.find_or_create_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
    rescue ActiveRecord::RecordNotUnique
      FitGapReport.find_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
    end
  end
end
