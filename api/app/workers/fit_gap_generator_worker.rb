# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    # Workers run without RequestStore, so default tenant scope is inactive.
    # Enforce the tenant boundary explicitly: vacancy must belong to the same
    # tenant as the portfolio's session (UU PDP / cross-tenant safety).
    vacancy = Vacancy.unscoped.find(vacancy_id)

    if vacancy.tenant_id != portfolio.session.tenant_id
      Rails.logger.error("[N13] Tenant mismatch: portfolio=#{portfolio_id} vacancy=#{vacancy_id} — refusing to generate")
      return
    end

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end
end