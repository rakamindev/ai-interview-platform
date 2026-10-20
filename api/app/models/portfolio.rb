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

  # A portfolio carries no tenant_id of its own — its organization is its
  # session's — so nothing scopes a bare `Portfolio.find`, and portfolio ids
  # are sequential. Without this, an assessor in one organization could
  # export, regenerate or delete another's candidates simply by counting
  # upward. Every controller lookup must go through here.
  scope :for_tenant, lambda { |tenant_id|
    joins(:session).where(sessions: { tenant_id: tenant_id })
  }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
end
