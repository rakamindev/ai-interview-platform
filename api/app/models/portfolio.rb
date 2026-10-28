# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze
  ERROR_CODES = %w[timeout rate_limited provider_denied provider_unavailable
                   invalid_output empty_output unknown].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills
  # Read-only here (review reasons). Deleting reports with the portfolio is a
  # separate decision (finding N7), so no dependent option is set.
  has_many :fit_gap_reports # rubocop:disable Rails/HasManyOrHasOneDependent

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :generation_error_code, inclusion: { in: ERROR_CODES }, allow_nil: true

  # Portfolios have no tenant column; ownership comes from the interview session.
  scope :for_tenant, ->(tenant_id) { joins(:session).where(sessions: { tenant_id: tenant_id }) }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
end
