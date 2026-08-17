# frozen_string_literal: true

class Portfolio < ApplicationRecord
  include TenantScoped

  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session, inverse_of: :portfolio
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  before_validation :inherit_tenant_from_session, on: :create

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'

  private

  # Portfolios carry the tenant of their session. `tenant_id` is NOT NULL on the
  # portfolios table, and the session is the authoritative tenant boundary.
  def inherit_tenant_from_session
    self.tenant_id ||= session&.tenant_id
  end
end
