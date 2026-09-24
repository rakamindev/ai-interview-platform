# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :generation_status, inclusion: { in: Portfolio::GENERATION_STATUSES }

  def generating? = generation_status == 'generating'
  def complete? = generation_status == 'complete'
  def failed? = generation_status == 'failed'

  scope :for_tenant, lambda { |tenant_id|
    joins(portfolio: :session).where(sessions: { tenant_id: tenant_id })
      .joins(:vacancy).where(vacancies: { tenant_id: tenant_id })
  }
end
