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

  # Assessor routes: portfolio tenant = session.tenant_id (see technical-decision Option A).
  scope :for_current_tenant, lambda {
    joins(:session).where(sessions: { tenant_id: Current.tenant_id })
  }

  def self.find_for_current_tenant!(id)
    for_current_tenant.find(id)
  end

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
end
