# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  class CrossTenantError < StandardError; end

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)

    # Vacancy is TenantScoped, but a Sidekiq worker has no request context, so
    # the default scope degrades to `all` here. Loading it unscoped is therefore
    # explicit rather than accidental — and is exactly why the check below is
    # needed: nothing in this process would otherwise stop a portfolio and a
    # vacancy from different tenants being compared.
    vacancy = Vacancy.unscoped.find(vacancy_id)

    assert_same_tenant!(portfolio, vacancy)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
  rescue CrossTenantError => e
    # Not retried: a mismatched pair will never become valid, and retrying would
    # only repeat the attempt to join two tenants' data.
    Rails.logger.error("[N13] #{e.message}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    raise
  end

  private

  def assert_same_tenant!(portfolio, vacancy)
    portfolio_tenant = portfolio.session.tenant_id
    return if portfolio_tenant == vacancy.tenant_id

    raise CrossTenantError,
          "Refusing to compare portfolio #{portfolio.id} (tenant #{portfolio_tenant}) " \
          "against vacancy #{vacancy.id} (tenant #{vacancy.tenant_id})"
  end
end
