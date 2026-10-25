# frozen_string_literal: true

module FitGap
  class RegenerationCoordinator
    def self.request!(portfolio:, vacancy:, force: false)
      new(portfolio:, vacancy:, force:).request!
    end

    def self.invalidate_portfolio!(portfolio_id:, tenant_id:)
      Current.using(tenant_id:) do
        portfolio = Portfolio.find_by(id: portfolio_id)
        return unless portfolio

        FitGapReport.where(portfolio_id:).includes(:vacancy).find_each do |report|
          request!(portfolio:, vacancy: report.vacancy)
        end
      end
    end

    def self.invalidate_vacancy!(vacancy_id:, tenant_id:)
      Current.using(tenant_id:) do
        vacancy = Vacancy.find_by(id: vacancy_id)
        return unless vacancy

        FitGapReport.where(vacancy_id:).includes(:portfolio).find_each do |report|
          request!(portfolio: report.portfolio, vacancy:)
        end
      end
    end

    def initialize(portfolio:, vacancy:, force: false)
      @portfolio = portfolio
      @vacancy = vacancy
      @force = force
    end

    def request!
      validate_inputs!
      snapshot = SourceFingerprint.call(portfolio: @portfolio, vacancy: @vacancy)
      enqueue = false

      Current.using(tenant_id: @portfolio.tenant_id) do
        report = find_or_create_report

        report.with_lock do
          if report.generating?
            report.update!(requested_fingerprint: snapshot.fingerprint) if report.requested_fingerprint != snapshot.fingerprint
          elsif @force || report.source_fingerprint != snapshot.fingerprint
            report.update!(
              generation_status: 'generating',
              generation_error: nil,
              requested_fingerprint: snapshot.fingerprint
            )
            enqueue = true
          end
        end

        FitGapGeneratorWorker.perform_async(@portfolio.id, @vacancy.id, snapshot.fingerprint) if enqueue
        report.reload
      end
    end

    private

    def validate_inputs!
      return if @portfolio.tenant_id == @vacancy.tenant_id

      raise ArgumentError, 'Portfolio and vacancy must belong to the same tenant'
    end

    def find_or_create_report
      FitGapReport.create_or_find_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id) do |report|
        report.skill_comparisons = []
        report.generation_status = 'complete'
        report.generated_at = nil
      end
    end
  end
end
