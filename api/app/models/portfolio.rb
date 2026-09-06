# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  # A portfolio has no tenant_id of its own; it is owned transitively, through
  # the session that produced it. `Portfolio.find(id)` therefore reaches every
  # tenant's data, and a controller that uses it performs a cross-tenant read.
  # Reaching portfolios through this scope is currently the only thing enforcing
  # isolation for them — see constraint signal CS-1, which argues the enforcement
  # belongs at the data layer instead of in each controller.
  scope :in_tenant, ->(tenant_id) { joins(:session).where(sessions: { tenant_id: tenant_id }) }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
end
