# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  CLAIM_TTL_SECONDS = 180

  def perform(portfolio_id, vacancy_id)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)
    claim_key = "fitgap:#{vacancy.id}"
    acquired = false

    portfolio.with_lock do
      claims = portfolio.has_attribute?(:job_claims) ? portfolio.job_claims : {}
      if FitGap::JobClaim.fresh?(claims, claim_key, ttl_seconds: CLAIM_TTL_SECONDS)
        Rails.logger.info("[N13] Skip duplicate fit/gap for portfolio=#{portfolio.id} vacancy=#{vacancy.id}")
        return
      end

      if portfolio.has_attribute?(:job_claims)
        portfolio.update!(job_claims: (claims || {}).merge(claim_key => Time.current.iso8601))
      end
      acquired = true
    end

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N13] Record not found for portfolio=#{portfolio_id} vacancy=#{vacancy_id}")
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}")
    raise
  ensure
    release_claim(portfolio_id, vacancy_id) if acquired
  end

  private

  def release_claim(portfolio_id, vacancy_id)
    portfolio = Portfolio.find_by(id: portfolio_id)
    return unless portfolio&.has_attribute?(:job_claims)

    portfolio.with_lock do
      claims = (portfolio.job_claims || {}).dup
      claims.delete("fitgap:#{vacancy_id}")
      portfolio.update!(job_claims: claims)
    end
  rescue StandardError => e
    Rails.logger.warn("[N13] Could not release fit/gap claim portfolio=#{portfolio_id}: #{e.class}")
  end
end
