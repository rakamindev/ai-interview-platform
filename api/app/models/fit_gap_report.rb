# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  include TenantScoped

  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  GENERATION_STATUSES = %w[complete generating failed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validate :skill_comparisons_must_be_an_array
  validate :portfolio_and_vacancy_share_tenant

  def complete? = generation_status == 'complete'
  def generating? = generation_status == 'generating'
  def failed? = generation_status == 'failed'
  def completed_payload? = generated_at.present?

  def freshness
    return 'failed' if failed?
    return 'updating' if generating?
    return 'outdated' if source_fingerprint.blank?

    current = FitGap::SourceFingerprint.call(portfolio:, vacancy:).fingerprint
    source_fingerprint == current ? 'current' : 'outdated'
  rescue ActiveRecord::RecordNotFound
    'outdated'
  end

  private

  def skill_comparisons_must_be_an_array
    errors.add(:skill_comparisons, 'must be an array') unless skill_comparisons.is_a?(Array)
  end

  def portfolio_and_vacancy_share_tenant
    return unless portfolio && vacancy
    return if portfolio.tenant_id == vacancy.tenant_id && tenant_id == portfolio.tenant_id

    errors.add(:base, 'Portfolio, vacancy, and report must belong to the same tenant')
  end
end
