# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    session   = Session.unscoped.find(portfolio.session_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    # Reject cross-tenant combinations
    if session.tenant_id != vacancy.tenant_id
      Rails.logger.error("[N13] Tenant mismatch between portfolio=#{portfolio_id} and vacancy=#{vacancy_id}")
      return
    end

    organization = Organization.find_by(id: session.tenant_id)
    Current.using(tenant_id: session.tenant_id, organization: organization) do
      FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
    end
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}")
    raise
  end
end
