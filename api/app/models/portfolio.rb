# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  # Portfolios carry no tenant_id; ownership comes from the session. Explicit tenant argument
  # (not the default scope) so a missing tenant fails closed instead of returning every row.
  scope :owned_by_tenant, ->(tenant_id) { where(session_id: Session.unscoped.where(tenant_id: tenant_id).select(:id)) }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
end
